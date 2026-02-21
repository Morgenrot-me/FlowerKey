package com.flowerkey.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import android.service.autofill.Dataset;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.*;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥自动填充认证界面
 * 若 App 已解锁：直接用 URL/packageName 匹配条目展示，用户一键填充
 * 若未解锁：输入主密码 → 验证 → 展示匹配条目
 */
public class AutofillAuthActivity extends Activity {

    static final String EXTRA_AUTOFILL_ID  = "autofill_id";
    static final String EXTRA_PACKAGE_NAME = "package_name";
    static final String EXTRA_WEB_DOMAIN   = "web_domain";

    private static final int    ITERATIONS = 600_000;
    private static final String SALT_VERIFY = "flowerkey_verify_";
    private static final String SALT_DBENC  = "flowerkey_dbenc_";

    private AutofillId autofillId;
    private String     packageName;
    private String     webDomain;   // 可能为 null（原生 app）

    private LinearLayout layout;
    private EditText     etMaster;
    private byte[]       dbKey;
    private String       userSalt;
    private String       masterPwd;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        autofillId  = getIntent().getParcelableExtra(EXTRA_AUTOFILL_ID);
        packageName = getIntent().getStringExtra(EXTRA_PACKAGE_NAME);
        webDomain   = getIntent().getStringExtra(EXTRA_WEB_DOMAIN);

        ScrollView scroll = new ScrollView(this);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int p = dp(16);
        layout.setPadding(p, p, p, p);
        scroll.addView(layout);
        setContentView(scroll);

        // 若 App 已解锁，直接进入条目选择步骤
        FlowerKeyApp app = FlowerKeyApp.get();
        if (app != null && app.isUnlocked()) {
            dbKey    = app.getDbKey();
            userSalt = app.getUserSalt();
            List<EntryItem> entries = queryMatchingEntries();
            showEntryStep(entries, null);
        } else {
            showMasterPwdStep();
        }
    }

    // ==================== 第一步：输入主密码（未解锁时） ====================

    private void showMasterPwdStep() {
        layout.removeAllViews();

        TextView title = new TextView(this);
        title.setText("🔑 花钥 - 自动填充");
        title.setTextSize(18);
        layout.addView(title);

        etMaster = new EditText(this);
        etMaster.setHint("主密码");
        etMaster.setInputType(android.text.InputType.TYPE_CLASS_TEXT |
                android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        layout.addView(etMaster);

        Button btnNext = new Button(this);
        btnNext.setText("验证");
        btnNext.setOnClickListener(v -> verifyAndProceed());
        layout.addView(btnNext);

        Button btnCancel = new Button(this);
        btnCancel.setText("取消");
        btnCancel.setOnClickListener(v -> { setResult(RESULT_CANCELED); finish(); });
        layout.addView(btnCancel);
    }

    private void verifyAndProceed() {
        masterPwd = etMaster.getText().toString();
        if (masterPwd.isEmpty()) return;
        try {
            SQLiteDatabase db = openDb();
            Cursor c = db.rawQuery("SELECT value FROM config WHERE key='masterPasswordData'", null);
            if (!c.moveToFirst()) { c.close(); db.close(); toast("花钥未初始化"); return; }
            JSONObject data = new JSONObject(c.getString(0));
            c.close(); db.close();

            userSalt = data.getString("userSalt");
            String verifySalt = data.optString("verifySalt", "");
            String storedHash = data.getString("verifyHash");

            String verifyInput = verifySalt.isEmpty() ? userSalt : verifySalt;
            byte[] hash = pbkdf2(masterPwd, SALT_VERIFY + verifyInput);
            if (!toHex(hash).equals(storedHash)) { toast("主密码错误"); return; }

            dbKey = pbkdf2(masterPwd, SALT_DBENC + userSalt);
            List<EntryItem> entries = queryMatchingEntries();
            showEntryStep(entries, masterPwd);
        } catch (Exception e) { toast("验证失败：" + e.getMessage()); }
    }

    // ==================== 第二步：展示匹配条目 ====================

    private void showEntryStep(List<EntryItem> entries, String master) {
        layout.removeAllViews();

        TextView title = new TextView(this);
        title.setText(entries.isEmpty() ? "选择区分代号" : "选择密码条目");
        title.setTextSize(16);
        layout.addView(title);

        // 展示匹配条目（一键填充）
        for (EntryItem entry : entries) {
            Button btn = new Button(this);
            String label = entry.codename;
            if (entry.description != null && !entry.description.isEmpty())
                label += "  " + entry.description;
            btn.setText(label);
            btn.setOnClickListener(v -> fillEntry(entry, master));
            layout.addView(btn);
        }

        // 手动输入代号（兜底）
        TextView hint = new TextView(this);
        hint.setText(entries.isEmpty() ? "未找到匹配条目，请手动输入：" : "或手动输入代号：");
        hint.setTextSize(12);
        layout.addView(hint);

        EditText etCodename = new EditText(this);
        etCodename.setHint("区分代号");
        layout.addView(etCodename);

        Button btnFill = new Button(this);
        btnFill.setText("生成并填充");
        btnFill.setOnClickListener(v -> {
            String codename = etCodename.getText().toString().trim();
            if (codename.isEmpty()) { toast("请输入区分代号"); return; }
            try {
                String pwd = generatePassword(master != null ? master : masterPwd, codename);
                returnPassword(pwd);
            } catch (Exception e) { toast("生成失败：" + e.getMessage()); }
        });
        layout.addView(btnFill);

        Button btnCancel = new Button(this);
        btnCancel.setText("取消");
        btnCancel.setOnClickListener(v -> { setResult(RESULT_CANCELED); finish(); });
        layout.addView(btnCancel);
    }

    private void fillEntry(EntryItem entry, String master) {
        try {
            String pwd;
            if (entry.storedPassword != null) {
                pwd = entry.storedPassword;
            } else {
                pwd = generatePassword(master != null ? master : masterPwd, entry.codename);
            }
            returnPassword(pwd);
        } catch (Exception e) { toast("填充失败：" + e.getMessage()); }
    }

    // ==================== 查询匹配条目 ====================

    private static class EntryItem {
        String codename, description, storedPassword;
    }

    /**
     * 按 webDomain（URL hostname）或 packageName 匹配条目
     * url 字段未加密，可直接 SQL 查询；codename/storedPassword 需解密
     */
    private List<EntryItem> queryMatchingEntries() {
        List<EntryItem> result = new ArrayList<>();
        try {
            SQLiteDatabase db = openDb();
            SecretKeySpec aesKey = new SecretKeySpec(dbKey, "AES");

            Cursor c;
            if (webDomain != null && !webDomain.isEmpty()) {
                // WebView/Chrome：按 URL hostname 匹配（url 字段存储完整 URL 或 hostname）
                c = db.rawQuery(
                    "SELECT codename, description, storedPassword FROM entries WHERE type='password' AND url LIKE ?",
                    new String[]{"%" + webDomain + "%"});
            } else {
                // 原生 app：按 appPackage 匹配
                c = db.rawQuery(
                    "SELECT codename, description, storedPassword FROM entries WHERE type='password' AND appPackage=?",
                    new String[]{packageName});
            }

            while (c.moveToNext()) {
                try {
                    EntryItem item = new EntryItem();
                    item.codename = aesGcmDecrypt(c.getString(0), aesKey);
                    String desc = c.getString(1);
                    item.description = (desc != null && !desc.isEmpty()) ? aesGcmDecrypt(desc, aesKey) : null;
                    String sp = c.getString(2);
                    item.storedPassword = (sp != null && !sp.isEmpty()) ? aesGcmDecrypt(sp, aesKey) : null;
                    result.add(item);
                } catch (Exception ignored) {}
            }
            c.close(); db.close();
        } catch (Exception ignored) {}
        return result;
    }

    // ==================== 加密工具 ====================

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

    private String generatePassword(String pwd, String codename) throws Exception {
        byte[] masterKey = pbkdf2(pwd, userSalt);
        byte[] rawBytes  = hmacSha256(masterKey, codename.getBytes(StandardCharsets.UTF_8));
        byte[] mixBytes  = hmacSha256(masterKey, (codename + "_mix").getBytes(StandardCharsets.UTF_8));
        return encodePassword(rawBytes, mixBytes, 16);
    }

    private String encodePassword(byte[] bytes, byte[] mix, int length) {
        final String ALPHANUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        final String LETTERS  = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        final String DIGITS   = "0123456789";
        char[] arr = new char[length];
        for (int i = 0; i < length; i++)
            arr[i] = ALPHANUM.charAt((bytes[i % bytes.length] & 0xFF) % ALPHANUM.length());
        arr[0] = LETTERS.charAt((mix[0] & 0xFF) % LETTERS.length());
        int digitPos = 1 + ((mix[1] & 0xFF) % (length - 1));
        arr[digitPos] = DIGITS.charAt((mix[2] & 0xFF) % DIGITS.length());
        return new String(arr);
    }

    private byte[] pbkdf2(String password, String salt) throws Exception {
        KeySpec spec = new PBEKeySpec(
            password.toCharArray(), salt.getBytes(StandardCharsets.UTF_8), ITERATIONS, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    }

    private byte[] hmacSha256(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private SQLiteDatabase openDb() {
        return SQLiteDatabase.openDatabase(
            getDatabasePath("flowerkeySQLite.db").getPath(),
            null, SQLiteDatabase.OPEN_READONLY);
    }

    private void returnPassword(String password) {
        Dataset dataset = new Dataset.Builder()
            .setValue(autofillId, AutofillValue.forText(password))
            .build();
        Intent reply = new Intent();
        reply.putExtra(android.service.autofill.AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset);
        setResult(RESULT_OK, reply);
        finish();
    }

    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show(); }
    private int dp(int dp) { return (int) (dp * getResources().getDisplayMetrics().density); }
}
