package com.flowerkey.app;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
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

import androidx.autofill.inline.v1.InlineSuggestionUi;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.Cipher;
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
                                : generatePassword(app.getMasterKey(), e.codename, e.passwordLength, e.charsetMode);
                            Dataset ds = buildInlineDataset(passwordFieldIds, pwd, e.codename, e.description, specs.get(i));
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
                                        String subtitle, InlinePresentationSpec spec) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null;
        try {
            PendingIntent attribution = PendingIntent.getActivity(this, label.hashCode(),
                new Intent(this, AutofillAuthActivity.class),
                PendingIntent.FLAG_IMMUTABLE);
            InlineSuggestionUi.Content.Builder cb = InlineSuggestionUi.newContentBuilder(attribution)
                .setTitle(label);
            if (subtitle != null && !subtitle.isEmpty()) cb.setSubtitle(subtitle);
            android.app.slice.Slice slice = cb.build().getSlice();
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
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        RemoteViews rv = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        rv.setTextViewText(android.R.id.text1, label);

        Dataset.Builder builder = new Dataset.Builder()
            .setAuthentication(pi.getIntentSender());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && spec != null) {
            try {
                android.app.slice.Slice slice = InlineSuggestionUi.newContentBuilder(pi)
                    .setTitle(label)
                    .build()
                    .getSlice();
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
        String codename, description, storedPassword, charsetMode;
        int passwordLength = 16;
    }

    private List<EntryItem> queryMatchingEntries(FlowerKeyApp app, String packageName, String webDomain) {
        List<EntryItem> result = new ArrayList<>();
        SQLiteDatabase db = null;
        Cursor c = null;
        try {
            db = SQLiteDatabase.openDatabase(
                getDatabasePath("flowerkeySQLite.db").getPath(), null, SQLiteDatabase.OPEN_READONLY);
            SecretKeySpec aesKey = new SecretKeySpec(app.getDbKey(), "AES");
            // url 明文存储，可直接 SQL LIKE 匹配；passwordLength/charsetMode 明文字段
            c = (webDomain != null && !webDomain.isEmpty())
                ? db.rawQuery("SELECT codename,storedPassword,passwordLength,charsetMode,description FROM entries WHERE type='password' AND url LIKE ?",
                    new String[]{"%" + webDomain + "%"})
                : db.rawQuery("SELECT codename,storedPassword,passwordLength,charsetMode,description FROM entries WHERE type='password' AND appPackage=?",
                    new String[]{packageName});
            while (c.moveToNext()) {
                try {
                    EntryItem item = new EntryItem();
                    item.codename = aesGcmDecrypt(c.getString(0), aesKey);
                    String sp = c.getString(1);
                    item.storedPassword = (sp != null && !sp.isEmpty()) ? aesGcmDecrypt(sp, aesKey) : null;
                    item.passwordLength = c.isNull(2) ? 16 : c.getInt(2);
                    item.charsetMode    = c.isNull(3) ? "alphanumeric" : c.getString(3);
                    String desc = c.getString(4);
                    item.description    = (desc != null && !desc.isEmpty()) ? aesGcmDecrypt(desc, aesKey) : null;
                    result.add(item);
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
            if (db != null) try { db.close(); } catch (Exception ignored) {}
        }
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

    private String generatePassword(byte[] masterKey, String codename, int length, String charsetMode) throws Exception {
        return PasswordGenerator.generate(masterKey, codename, length, charsetMode);
    }

    // ==================== AssistStructure 解析 ====================

    private List<AutofillId> findPasswordFields(AssistStructure.ViewNode node) {
        List<AutofillId> all = new ArrayList<>();
        List<AutofillId> newPwd = new ArrayList<>();
        AutofillId[] focused = {null};
        boolean[] focusedIsNew = {false};
        collectPasswordFields(node, all, newPwd, focused, focusedIsNew);
        if (focused[0] == null) return all.isEmpty() ? all : java.util.Collections.singletonList(all.get(0));
        // 焦点在新密码框 → 返回所有新密码框（新密码+确认框同时填）
        // 焦点在普通密码框 → 只返回该框
        if (focusedIsNew[0]) return newPwd.isEmpty() ? java.util.Collections.singletonList(focused[0]) : newPwd;
        return java.util.Collections.singletonList(focused[0]);
    }

    private void collectPasswordFields(AssistStructure.ViewNode node,
                                        List<AutofillId> all, List<AutofillId> newPwd,
                                        AutofillId[] focused, boolean[] focusedIsNew) {
        if (node.getAutofillType() != android.view.View.AUTOFILL_TYPE_NONE) {
            String[] hints = node.getAutofillHints();
            boolean isPwd = false, isNew = false;
            if (hints != null) {
                for (String h : hints) {
                    if (h == null) continue;
                    String hl = h.toLowerCase();
                    if (hl.contains("password")) isPwd = true;
                    if (hl.contains("new") || hl.equals("new-password")) isNew = true;
                }
            }
            if (!isPwd) {
                int variation = node.getInputType() & android.text.InputType.TYPE_MASK_VARIATION;
                if (variation == android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                        || variation == android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                        || variation == android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD) {
                    isPwd = true;
                }
            }
            if (isPwd) {
                all.add(node.getAutofillId());
                if (isNew) newPwd.add(node.getAutofillId());
                if (node.isFocused()) { focused[0] = node.getAutofillId(); focusedIsNew[0] = isNew; }
            }
        }
        for (int i = 0; i < node.getChildCount(); i++)
            collectPasswordFields(node.getChildAt(i), all, newPwd, focused, focusedIsNew);
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
