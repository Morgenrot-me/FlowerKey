package com.flowerkey.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.os.Bundle;
import android.service.autofill.Dataset;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥自动填充认证界面
 * 弹出对话框让用户输入主密码和区分代号，生成密码后回传给 AutofillService 填充
 */
public class AutofillAuthActivity extends Activity {

    static final String EXTRA_AUTOFILL_ID = "autofill_id";
    static final String EXTRA_PACKAGE_NAME = "package_name";

    private AutofillId autofillId;
    private String packageName;
    private List<String> matchedCodenames = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        autofillId = getIntent().getParcelableExtra(EXTRA_AUTOFILL_ID);
        packageName = getIntent().getStringExtra(EXTRA_PACKAGE_NAME);

        // 查询 SQLite 中匹配此包名/URL 的条目
        matchedCodenames = queryMatchedCodenames(packageName);

        buildUI();
    }

    private void buildUI() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int p = dp(16);
        layout.setPadding(p, p, p, p);

        TextView title = new TextView(this);
        title.setText("🔑 花钥 - 自动填充");
        title.setTextSize(18);
        layout.addView(title);

        EditText etMaster = new EditText(this);
        etMaster.setHint("主密码");
        etMaster.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        layout.addView(etMaster);

        EditText etCodename = new EditText(this);
        etCodename.setHint("区分代号");
        // 若有匹配条目，预填第一个
        if (!matchedCodenames.isEmpty()) etCodename.setText(matchedCodenames.get(0));
        layout.addView(etCodename);

        // 若有多个匹配，列出供选择
        if (matchedCodenames.size() > 1) {
            TextView hint = new TextView(this);
            hint.setText("此应用已有以下代号：" + String.join("、", matchedCodenames));
            hint.setTextSize(12);
            layout.addView(hint);
        }

        Button btnFill = new Button(this);
        btnFill.setText("生成并填充");
        btnFill.setOnClickListener(v -> {
            String master = etMaster.getText().toString().trim();
            String codename = etCodename.getText().toString().trim();
            if (master.isEmpty() || codename.isEmpty()) {
                Toast.makeText(this, "请填写主密码和区分代号", Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                String password = generatePassword(master, codename);
                returnPassword(password);
            } catch (Exception e) {
                Toast.makeText(this, "生成失败：" + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
        layout.addView(btnFill);

        Button btnCancel = new Button(this);
        btnCancel.setText("取消");
        btnCancel.setOnClickListener(v -> { setResult(RESULT_CANCELED); finish(); });
        layout.addView(btnCancel);

        scroll.addView(layout);
        setContentView(scroll);
    }

    /** 查询 SQLite 中 url 或 description 包含包名的密码条目（明文 codename 字段已加密，只能匹配 type） */
    private List<String> queryMatchedCodenames(String pkg) {
        List<String> result = new ArrayList<>();
        // 注意：codename 是加密存储的，无法直接匹配；此处仅返回所有密码条目供用户选择
        // 若未来改为明文存储 codename，可在此处过滤
        try {
            SQLiteDatabase db = SQLiteDatabase.openDatabase(
                getDatabasePath("flowerkeySQLite.db").getPath(),
                null, SQLiteDatabase.OPEN_READONLY);
            Cursor c = db.rawQuery("SELECT codename FROM entries WHERE type='password' LIMIT 20", null);
            while (c.moveToNext()) {
                String enc = c.getString(0);
                if (enc != null) result.add("[已加密]"); // codename 加密，显示占位
            }
            c.close();
            db.close();
        } catch (Exception ignored) {}
        return result;
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

    /**
     * Java 实现密码生成，与 crypto.ts 完全一致：
     * masterKey = PBKDF2(masterPwd, userSalt="FlowerKey", 600000, SHA-256, 256bit)
     * rawBytes  = HMAC-SHA256(masterKey, codename)
     * mixBytes  = HMAC-SHA256(masterKey, codename+"_mix")
     * 编码为字母+数字字符集
     */
    private String generatePassword(String masterPwd, String codename) throws Exception {
        final String userSalt = "FlowerKey";
        final int ITERATIONS = 600_000;
        final int KEY_LEN = 256;

        // PBKDF2
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        KeySpec spec = new PBEKeySpec(masterPwd.toCharArray(), userSalt.getBytes(StandardCharsets.UTF_8), ITERATIONS, KEY_LEN);
        byte[] masterKey = factory.generateSecret(spec).getEncoded();

        // HMAC-SHA256
        byte[] rawBytes = hmacSha256(masterKey, codename.getBytes(StandardCharsets.UTF_8));
        byte[] mixBytes = hmacSha256(masterKey, (codename + "_mix").getBytes(StandardCharsets.UTF_8));

        return encodePassword(rawBytes, mixBytes, 16);
    }

    private byte[] hmacSha256(byte[] key, byte[] data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private String encodePassword(byte[] bytes, byte[] mix, int length) {
        final String ALPHANUM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        final String LETTERS  = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        final String DIGITS   = "0123456789";

        char[] arr = new char[length];
        for (int i = 0; i < length; i++) {
            arr[i] = ALPHANUM.charAt((bytes[i % bytes.length] & 0xFF) % ALPHANUM.length());
        }
        // 首位字母，第 digitPos 位数字（与 crypto.ts 逻辑一致）
        arr[0] = LETTERS.charAt((mix[0] & 0xFF) % LETTERS.length());
        int digitPos = 1 + ((mix[1] & 0xFF) % (length - 1));
        arr[digitPos] = DIGITS.charAt((mix[2] & 0xFF) % DIGITS.length());
        return new String(arr);
    }

    private int dp(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density);
    }
}
