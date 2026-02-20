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

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥自动填充认证界面
 * 流程：输入主密码 → 验证 → 解密 codename 列表 → 用户选择/输入 → 生成密码 → 回传填充
 */
public class AutofillAuthActivity extends Activity {

    static final String EXTRA_AUTOFILL_ID = "autofill_id";
    static final String EXTRA_PACKAGE_NAME = "package_name";

    private static final int ITERATIONS = 600_000;
    private static final String SALT_VERIFY = "flowerkey_verify_";
    private static final String SALT_DBENC  = "flowerkey_dbenc_";

    private AutofillId autofillId;

    // UI 阶段：0=输入主密码, 1=选择/输入代号
    private LinearLayout layout;
    private EditText etMaster;
    private byte[] dbKey;
    private String userSalt;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        autofillId = getIntent().getParcelableExtra(EXTRA_AUTOFILL_ID);

        ScrollView scroll = new ScrollView(this);
        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int p = dp(16);
        layout.setPadding(p, p, p, p);
        scroll.addView(layout);
        setContentView(scroll);

        showMasterPwdStep();
    }

    // ==================== 第一步：输入主密码 ====================

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
        String master = etMaster.getText().toString();
        if (master.isEmpty()) return;
        try {
            // 读取 masterPasswordData
            SQLiteDatabase db = openDb();
            Cursor c = db.rawQuery(
                "SELECT value FROM config WHERE key='masterPasswordData'", null);
            if (!c.moveToFirst()) { c.close(); db.close(); toast("花钥未初始化"); return; }
            JSONObject data = new JSONObject(c.getString(0));
            c.close(); db.close();

            userSalt = data.getString("userSalt");
            String verifySalt = data.optString("verifySalt", "");
            String storedHash = data.getString("verifyHash");

            // 验证主密码：PBKDF2(master, "flowerkey_verify_" + verifySalt)
            String verifyInput = verifySalt.isEmpty() ? userSalt : verifySalt;
            byte[] hash = pbkdf2(master, SALT_VERIFY + verifyInput);
            if (!toHex(hash).equals(storedHash)) {
                toast("主密码错误");
                return;
            }

            // 派生 dbKey：PBKDF2(master, "flowerkey_dbenc_" + userSalt)
            dbKey = pbkdf2(master, SALT_DBENC + userSalt);

            // 解密所有 codename，进入第二步
            List<String> codenames = decryptCodenames();
            showCodenameStep(master, codenames);

        } catch (Exception e) {
            toast("验证失败：" + e.getMessage());
        }
    }

    // ==================== 第二步：选择/输入代号 ====================

    private void showCodenameStep(String master, List<String> codenames) {
        layout.removeAllViews();

        TextView title = new TextView(this);
        title.setText("选择区分代号");
        title.setTextSize(16);
        layout.addView(title);

        EditText etCodename = new EditText(this);
        etCodename.setHint("区分代号");
        if (!codenames.isEmpty()) etCodename.setText(codenames.get(0));
        layout.addView(etCodename);

        // 已有代号列表，点击快速填入
        for (String cn : codenames) {
            Button btn = new Button(this);
            btn.setText(cn);
            btn.setOnClickListener(v -> etCodename.setText(cn));
            layout.addView(btn);
        }

        Button btnFill = new Button(this);
        btnFill.setText("生成并填充");
        btnFill.setOnClickListener(v -> {
            String codename = etCodename.getText().toString().trim();
            if (codename.isEmpty()) { toast("请输入区分代号"); return; }
            try {
                String password = generatePassword(master, codename);
                returnPassword(password);
            } catch (Exception e) {
                toast("生成失败：" + e.getMessage());
            }
        });
        layout.addView(btnFill);

        Button btnBack = new Button(this);
        btnBack.setText("返回");
        btnBack.setOnClickListener(v -> showMasterPwdStep());
        layout.addView(btnBack);
    }

    // ==================== 解密 codename ====================

    private List<String> decryptCodenames() {
        List<String> result = new ArrayList<>();
        try {
            SQLiteDatabase db = openDb();
            Cursor c = db.rawQuery(
                "SELECT codename FROM entries WHERE type='password' AND appPackage=? AND codename IS NOT NULL",
                new String[]{packageName});
            SecretKeySpec aesKey = new SecretKeySpec(dbKey, "AES");
            while (c.moveToNext()) {
                try { result.add(aesGcmDecrypt(c.getString(0), aesKey)); } catch (Exception ignored) {}
            }
            c.close(); db.close();
        } catch (Exception ignored) {}
        return result;
    }

    /** AES-256-GCM 解密，格式：[version(1B) + IV(12B) + ciphertext+tag] base64 */
    private String aesGcmDecrypt(String b64, SecretKeySpec key) throws Exception {
        byte[] bytes = Base64.getDecoder().decode(b64);
        // bytes[0] = version, bytes[1..12] = IV, bytes[13..] = ciphertext+tag
        byte[] iv = new byte[12];
        System.arraycopy(bytes, 1, iv, 0, 12);
        byte[] ct = new byte[bytes.length - 13];
        System.arraycopy(bytes, 13, ct, 0, ct.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
    }

    // ==================== 密码生成 ====================

    private String generatePassword(String masterPwd, String codename) throws Exception {
        byte[] masterKey = pbkdf2(masterPwd, userSalt);
        byte[] rawBytes = hmacSha256(masterKey, codename.getBytes(StandardCharsets.UTF_8));
        byte[] mixBytes = hmacSha256(masterKey, (codename + "_mix").getBytes(StandardCharsets.UTF_8));
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

    // ==================== 工具方法 ====================

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

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }

    private int dp(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }
}
