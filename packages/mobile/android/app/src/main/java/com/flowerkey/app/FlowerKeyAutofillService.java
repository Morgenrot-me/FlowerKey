package com.flowerkey.app;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.app.slice.Slice;
import android.app.slice.SliceSpec;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Build;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.InlinePresentation;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveRequest;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;
import android.widget.inline.InlinePresentationSpec;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥自动填充服务
 * Android 11+：已解锁且有匹配条目时直接内联建议，点击即填充，无需打开界面
 * 未解锁 / 无匹配 / Android 10-：退回 AutofillAuthActivity Dialog 流程
 */
public class FlowerKeyAutofillService extends AutofillService {

    @Override
    public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
        List<FillContext> contexts = request.getFillContexts();
        AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();

        List<AutofillId> passwordFieldIds = findPasswordFields(structure.getWindowNodeAt(0).getRootViewNode());
        if (passwordFieldIds.isEmpty()) { callback.onSuccess(null); return; }
        AutofillId primaryId = passwordFieldIds.get(0);

        String packageName = structure.getActivityComponent().getPackageName();
        String webDomain = extractWebDomain(structure.getWindowNodeAt(0).getRootViewNode());
        FlowerKeyApp app = FlowerKeyApp.get();

        // Android 11+ 且已解锁：尝试内联建议
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && app != null && app.isUnlocked()
                && request.getInlineSuggestionsRequest() != null) {

            List<InlinePresentationSpec> specs =
                request.getInlineSuggestionsRequest().getInlinePresentationSpecs();

            if (!specs.isEmpty()) {
                List<EntryItem> entries = queryMatchingEntries(app, packageName, webDomain);
                if (!entries.isEmpty()) {
                    FillResponse.Builder rb = new FillResponse.Builder();
                    int max = Math.min(entries.size(), specs.size());
                    for (int i = 0; i < max; i++) {
                        try {
                            EntryItem e = entries.get(i);
                            String pwd = e.storedPassword != null ? e.storedPassword
                                : generatePassword(app.getMasterKey(), e.codename);
                            Dataset ds = buildInlineDataset(passwordFieldIds, pwd, e.codename, specs.get(i));
                            if (ds != null) rb.addDataset(ds);
                        } catch (Exception ignored) {}
                    }
                    rb.addDataset(buildAuthDataset(passwordFieldIds, packageName, webDomain, null, "更多..."));
                    callback.onSuccess(rb.build());
                    return;
                }
            }
        }

        // 退回 Authentication 流程
        callback.onSuccess(new FillResponse.Builder()
            .addDataset(buildAuthDataset(passwordFieldIds, packageName, webDomain, null, "🔑 使用花钥填充密码"))
            .build());
    }

    @Override
    public void onSaveRequest(SaveRequest request, SaveCallback callback) { callback.onSuccess(); }

    // ==================== Dataset 构建 ====================

    private Dataset buildInlineDataset(List<AutofillId> fieldIds, String password, String label,
                                        InlinePresentationSpec spec) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null;
        try {
            Slice slice = new Slice.Builder(
                    android.net.Uri.parse("content://com.flowerkey.app/inline/" + label),
                    new SliceSpec("androidx.slice", 1))
                .addText(label, null, Collections.singletonList(android.app.slice.SliceItem.FORMAT_TEXT))
                .build();
            RemoteViews rv = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
            rv.setTextViewText(android.R.id.text1, label);
            Dataset.Builder builder = new Dataset.Builder();
            for (AutofillId id : fieldIds) {
                builder.setValue(id, AutofillValue.forText(password), rv,
                    new InlinePresentation(slice, spec, false));
            }
            return builder.build();
        } catch (Exception e) { return null; }
    }

    private Dataset buildAuthDataset(List<AutofillId> fieldIds, String packageName, String webDomain,
                                      InlinePresentationSpec spec, String label) {
        Intent intent = new Intent(this, AutofillAuthActivity.class);
        intent.putParcelableArrayListExtra(AutofillAuthActivity.EXTRA_AUTOFILL_IDS,
            new ArrayList<>(fieldIds));
        intent.putExtra(AutofillAuthActivity.EXTRA_PACKAGE_NAME, packageName);
        if (webDomain != null) intent.putExtra(AutofillAuthActivity.EXTRA_WEB_DOMAIN, webDomain);
        PendingIntent pi = PendingIntent.getActivity(this, packageName.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

        RemoteViews rv = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        rv.setTextViewText(android.R.id.text1, label);

        Dataset.Builder builder = new Dataset.Builder()
            .setAuthentication(pi.getIntentSender());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && spec != null) {
            try {
                Slice slice = new Slice.Builder(
                        android.net.Uri.parse("content://com.flowerkey.app/inline/more"),
                        new SliceSpec("androidx.slice", 1))
                    .addText(label, null, Collections.singletonList(android.app.slice.SliceItem.FORMAT_TEXT))
                    .build();
                builder.setValue(fieldIds.get(0), null, rv,
                    new InlinePresentation(slice, spec, false));
            } catch (Exception ignored) {}
        } else {
            builder.setValue(fieldIds.get(0), null, rv);
        }
        return builder.build();
    }

    // ==================== 查询匹配条目 ====================

    static class EntryItem {
        String codename, storedPassword;
    }

    private List<EntryItem> queryMatchingEntries(FlowerKeyApp app, String packageName, String webDomain) {
        List<EntryItem> result = new ArrayList<>();
        try {
            SQLiteDatabase db = SQLiteDatabase.openDatabase(
                getDatabasePath("flowerkeySQLite.db").getPath(), null, SQLiteDatabase.OPEN_READONLY);
            SecretKeySpec aesKey = new SecretKeySpec(app.getDbKey(), "AES");
            // url 明文存储，可直接 SQL LIKE 匹配
            Cursor c = (webDomain != null && !webDomain.isEmpty())
                ? db.rawQuery("SELECT codename,storedPassword FROM entries WHERE type='password' AND url LIKE ?",
                    new String[]{"%" + webDomain + "%"})
                : db.rawQuery("SELECT codename,storedPassword FROM entries WHERE type='password' AND appPackage=?",
                    new String[]{packageName});
            while (c.moveToNext()) {
                try {
                    EntryItem item = new EntryItem();
                    item.codename = aesGcmDecrypt(c.getString(0), aesKey);
                    String sp = c.getString(1);
                    item.storedPassword = (sp != null && !sp.isEmpty()) ? aesGcmDecrypt(sp, aesKey) : null;
                    result.add(item);
                } catch (Exception ignored) {}
            }
            c.close(); db.close();
        } catch (Exception ignored) {}
        return result;
    }

    // ==================== 加密 / 密码生成 ====================

    private String aesGcmDecrypt(String b64, SecretKeySpec key) throws Exception {
        byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
        byte[] iv = new byte[12];
        System.arraycopy(bytes, 1, iv, 0, 12);
        byte[] ct = new byte[bytes.length - 13];
        System.arraycopy(bytes, 13, ct, 0, ct.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
    }

    private String generatePassword(byte[] masterKey, String codename) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(masterKey, "HmacSHA256"));
        byte[] raw = mac.doFinal(codename.getBytes(StandardCharsets.UTF_8));
        mac.init(new SecretKeySpec(masterKey, "HmacSHA256"));
        byte[] mix = mac.doFinal((codename + "_mix").getBytes(StandardCharsets.UTF_8));
        final String AN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        final String L  = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        final String D  = "0123456789";
        char[] arr = new char[16];
        for (int i = 0; i < 16; i++) arr[i] = AN.charAt((raw[i % raw.length] & 0xFF) % AN.length());
        arr[0] = L.charAt((mix[0] & 0xFF) % L.length());
        arr[1 + ((mix[1] & 0xFF) % 15)] = D.charAt((mix[2] & 0xFF) % D.length());
        return new String(arr);
    }

    // ==================== AssistStructure 解析 ====================

    private List<AutofillId> findPasswordFields(AssistStructure.ViewNode node) {
        List<AutofillId> all = new ArrayList<>();
        List<AutofillId> newPwd = new ArrayList<>();
        collectPasswordFields(node, all, newPwd);
        // 全是新密码框（注册/改密纯新密码）→ 全填；否则只填非新密码框
        if (!newPwd.isEmpty() && newPwd.size() == all.size()) return all;
        List<AutofillId> current = new ArrayList<>(all);
        current.removeAll(newPwd);
        return current.isEmpty() ? all : current;
    }

    private void collectPasswordFields(AssistStructure.ViewNode node,
                                        List<AutofillId> all, List<AutofillId> newPwd) {
        if (node.getAutofillType() != android.view.View.AUTOFILL_TYPE_NONE) {
            String[] hints = node.getAutofillHints();
            if (hints != null) {
                boolean isPwd = false, isNew = false;
                for (String h : hints) {
                    if (h == null) continue;
                    String hl = h.toLowerCase();
                    if (hl.contains("password")) isPwd = true;
                    if (hl.contains("new") || hl.equals("new-password")) isNew = true;
                }
                if (isPwd) {
                    all.add(node.getAutofillId());
                    if (isNew) newPwd.add(node.getAutofillId());
                    for (int i = 0; i < node.getChildCount(); i++) collectPasswordFields(node.getChildAt(i), all, newPwd);
                    return;
                }
            }
            if ((node.getInputType() & 0x80) != 0) all.add(node.getAutofillId());
        }
        for (int i = 0; i < node.getChildCount(); i++) collectPasswordFields(node.getChildAt(i), all, newPwd);
    }

    private String extractWebDomain(AssistStructure.ViewNode node) {
        String domain = node.getWebDomain();
        if (domain != null && !domain.isEmpty()) return domain;
        for (int i = 0; i < node.getChildCount(); i++) {
            String found = extractWebDomain(node.getChildAt(i));
            if (found != null) return found;
        }
        return null;
    }
}
