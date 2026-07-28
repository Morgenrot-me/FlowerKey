package com.flowerkey.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.service.autofill.Dataset;
import android.view.Gravity;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.*;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥自动填充认证界面（Dialog 主题）
 * 已解锁：直接展示匹配条目（全量解密过滤 url）
 * 未解锁：输入主密码 → 验证 → 展示匹配条目
 */
public class AutofillAuthActivity extends Activity {

    static final String EXTRA_AUTOFILL_IDS  = "autofill_ids";
    static final String EXTRA_PACKAGE_NAME = "package_name";
    static final String EXTRA_WEB_DOMAIN   = "web_domain";

    private static final int    ITERATIONS  = 600_000;
    private static final String SALT_VERIFY = "flowerkey_verify_";
    private static final String SALT_DBENC  = "flowerkey_dbenc_";

    // 配色（运行时根据系统深浅色初始化）
    private int COLOR_BG;
    private int COLOR_SURFACE;
    private int COLOR_ACCENT;
    private int COLOR_TEXT;
    private int COLOR_HINT;
    private int COLOR_DIVIDER;

    private void initColors() {
        boolean dark = (getResources().getConfiguration().uiMode
            & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        if (dark) {
            COLOR_BG      = 0xFF1E1E2E;
            COLOR_SURFACE = 0xFF2A2A3E;
            COLOR_ACCENT  = 0xFF7C6AF7;
            COLOR_TEXT    = 0xFFE0E0F0;
            COLOR_HINT    = 0xFF888899;
            COLOR_DIVIDER = 0xFF3A3A50;
        } else {
            COLOR_BG      = 0xFFF5F5F7;
            COLOR_SURFACE = 0xFFFFFFFF;
            COLOR_ACCENT  = 0xFF3B9EFF;
            COLOR_TEXT    = 0xFF1A1A2E;
            COLOR_HINT    = 0xFF888899;
            COLOR_DIVIDER = 0xFFDDDDE8;
        }
    }

    private java.util.List<AutofillId> autofillIds;
    private String     packageName;
    private String     webDomain;

    private LinearLayout layout;
    private EditText     etMaster;
    private byte[]       dbKey;
    private String       userSalt;

    @Override
    protected void onDestroy() {
        if (dbKey != null) { java.util.Arrays.fill(dbKey, (byte) 0); dbKey = null; }
        super.onDestroy();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE,
            android.view.WindowManager.LayoutParams.FLAG_SECURE);
        autofillIds = getIntent().getParcelableArrayListExtra(EXTRA_AUTOFILL_IDS);
        packageName = getIntent().getStringExtra(EXTRA_PACKAGE_NAME);
        webDomain   = getIntent().getStringExtra(EXTRA_WEB_DOMAIN);
        if (autofillIds == null || autofillIds.isEmpty()) { finish(); return; }
        initColors();

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(COLOR_BG);

        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int p = dp(20);
        layout.setPadding(p, dp(16), p, dp(16));
        scroll.addView(layout);
        setContentView(scroll);

        FlowerKeyApp app = FlowerKeyApp.get();
        if (app != null && app.isUnlocked()) {
            dbKey    = app.getDbKey();
            userSalt = app.getUserSalt();
            showEntryStep(queryMatchingEntries(), true);
        } else {
            showMasterPwdStep();
        }
    }

    // ==================== 第一步：输入主密码 ====================

    private void showMasterPwdStep() {
        layout.removeAllViews();
        layout.addView(makeTitle("花钥 · 自动填充"));
        layout.addView(makeDivider());

        etMaster = makeEditText("主密码", true);
        layout.addView(etMaster);
        layout.addView(makeSpacing(8));

        layout.addView(makeButton("验证", COLOR_ACCENT, v -> verifyAndProceed()));
        layout.addView(makeSpacing(8));
        layout.addView(makeButton("取消", COLOR_SURFACE, v -> { setResult(RESULT_CANCELED); finish(); }));
    }

    private void verifyAndProceed() {
        String pwd = etMaster.getText().toString();
        if (pwd.isEmpty()) return;
        SQLiteDatabase db = null;
        Cursor c = null;
        try {
            db = openDb();
            c = db.rawQuery("SELECT value FROM config WHERE key='masterPasswordData'", null);
            if (!c.moveToFirst()) { toast("花钥未初始化"); return; }
            JSONObject data = new JSONObject(c.getString(0));

            userSalt = data.getString("userSalt");
            String verifySalt = data.optString("verifySalt", "");
            String storedHash = data.getString("verifyHash");
            String verifyInput = verifySalt.isEmpty() ? userSalt : verifySalt;

            byte[] hash = pbkdf2(pwd, SALT_VERIFY + verifyInput);
            if (!toHex(hash).equals(storedHash)) { toast("主密码错误"); return; }

            dbKey = pbkdf2(pwd, SALT_DBENC + userSalt);
            // 存入 App 内存，后续生成密码用
            byte[] masterKey = pbkdf2(pwd, PasswordGenerator.normalizeIdentitySecret(userSalt));
            FlowerKeyApp app2 = FlowerKeyApp.get();
            if (app2 != null) app2.setUnlocked(dbKey, masterKey, userSalt);

            showEntryStep(queryMatchingEntries(), false);
        } catch (Exception e) { toast("验证失败：" + e.getMessage()); }
        finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
            if (db != null) try { db.close(); } catch (Exception ignored) {}
        }
    }

    // ==================== 第二步：展示匹配条目 ====================

    private void showEntryStep(List<EntryItem> entries, boolean wasAlreadyUnlocked) {
        layout.removeAllViews();
        layout.addView(makeTitle("花钥 · 选择条目"));
        layout.addView(makeDivider());

        if (!entries.isEmpty()) {
            for (EntryItem entry : entries) {
                layout.addView(makeEntryButton(entry));
                layout.addView(makeSpacing(6));
            }
        }

        TextView hint = new TextView(this);
        hint.setText(entries.isEmpty() ? "未找到匹配条目，请手动输入代号：" : "或手动输入代号：");
        hint.setTextColor(COLOR_HINT);
        hint.setTextSize(12);
        hint.setPadding(0, dp(8), 0, dp(4));
        layout.addView(hint);

        EditText etCodename = makeEditText("区分代号", false);
        layout.addView(etCodename);

        TextView tvPreview = new TextView(this);
        tvPreview.setTextColor(COLOR_ACCENT);
        tvPreview.setTextSize(13);
        tvPreview.setTypeface(android.graphics.Typeface.MONOSPACE);
        tvPreview.setPadding(dp(4), dp(4), dp(4), 0);
        tvPreview.setVisibility(android.view.View.GONE);
        layout.addView(tvPreview);
        layout.addView(makeSpacing(8));

        etCodename.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence s, int st, int c, int a) {}
            public void onTextChanged(CharSequence s, int st, int b, int c) {}
            public void afterTextChanged(android.text.Editable s) {
                String code = s.toString().trim();
                if (code.isEmpty()) { tvPreview.setVisibility(android.view.View.GONE); return; }
                try {
                    EntryItem found = lookupEntryByCodename(code);
                    int len = (found != null) ? found.passwordLength : 16;
                    String mode = (found != null) ? found.charsetMode : "alphanumeric";
                    String pwd = generatePassword(code, len, mode);
                    String masked = pwd.length() <= 10 ? pwd : pwd.substring(0, 5) + "•••••" + pwd.substring(pwd.length() - 5);
                    tvPreview.setText("预览：" + masked);
                    tvPreview.setVisibility(android.view.View.VISIBLE);
                } catch (Exception ignored) { tvPreview.setVisibility(android.view.View.GONE); }
            }
        });

        layout.addView(makeButton("生成并填充", COLOR_ACCENT, v -> {
            String codename = etCodename.getText().toString().trim();
            if (codename.isEmpty()) { toast("请输入区分代号"); return; }
            try {
                saveAssociation(codename);
                EntryItem found = lookupEntryByCodename(codename);
                int len = (found != null) ? found.passwordLength : 16;
                String mode = (found != null) ? found.charsetMode : "alphanumeric";
                returnPassword(generatePassword(codename, len, mode), codename);
            } catch (Exception e) { toast("生成失败：" + e.getMessage()); }
        }));
        layout.addView(makeSpacing(8));
        layout.addView(makeButton("取消", COLOR_SURFACE, v -> { setResult(RESULT_CANCELED); finish(); }));
    }

    private android.view.View makeEntryButton(EntryItem entry) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(dp(14), dp(12), dp(14), dp(12));
        row.setClickable(true);
        row.setFocusable(true);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(COLOR_SURFACE);
        bg.setCornerRadius(dp(10));
        bg.setStroke(dp(1), COLOR_DIVIDER);
        row.setBackground(bg);

        TextView tvName = new TextView(this);
        tvName.setText(entry.codename);
        tvName.setTextColor(COLOR_TEXT);
        tvName.setTextSize(15);
        tvName.setTypeface(null, Typeface.BOLD);
        row.addView(tvName);

        if (entry.description != null && !entry.description.isEmpty()) {
            TextView tvDesc = new TextView(this);
            tvDesc.setText(entry.description);
            tvDesc.setTextColor(COLOR_HINT);
            tvDesc.setTextSize(12);
            tvDesc.setPadding(0, dp(2), 0, 0);
            row.addView(tvDesc);
        }

        row.setOnClickListener(v -> {
            try {
                updateLastUsed(entry.id);
                returnPassword(entry.storedPassword != null ? entry.storedPassword : generatePassword(entry.codename, entry.passwordLength, entry.charsetMode), entry.codename);
            } catch (Exception e) { toast("填充失败：" + e.getMessage()); }
        });
        return row;
    }

    // ==================== 保存关联 ====================

    /**
     * 手动输入代号填充后：
     * - 找到匹配条目 → 更新 url/appPackage
     * - 未找到 → 新建条目（codename 加密，url/appPackage 明文）
     */
    private void saveAssociation(String codename) {
        SQLiteDatabase db = null;
        Cursor c = null;
        try {
            db = SQLiteDatabase.openDatabase(
                getDatabasePath("flowerkeySQLite.db").getPath(), null, SQLiteDatabase.OPEN_READWRITE);
            SecretKeySpec aesKey = new SecretKeySpec(dbKey, "AES");
            c = db.rawQuery("SELECT id, codename FROM entries WHERE type='password'", null);
            String targetId = null;
            while (c.moveToNext()) {
                try {
                    if (PasswordGenerator.normalizeCodename(codename).equals(
                        PasswordGenerator.normalizeCodename(aesGcmDecrypt(c.getString(1), aesKey))
                    )) {
                        targetId = c.getString(0); break;
                    }
                } catch (Exception ignored) {}
            }
            c.close(); c = null;
            String changedId;
            if (targetId != null) {
                changedId = targetId;
                if (webDomain != null && !webDomain.isEmpty())
                    db.execSQL("UPDATE entries SET url=? WHERE id=?", new Object[]{webDomain, targetId});
                else
                    db.execSQL("UPDATE entries SET appPackage=? WHERE id=?", new Object[]{packageName, targetId});
            } else {
                // 新建条目
                String id = java.util.UUID.randomUUID().toString();
                changedId = id;
                String encCodename = aesGcmEncrypt(codename, aesKey);
                long now = System.currentTimeMillis();
                String url = (webDomain != null && !webDomain.isEmpty()) ? webDomain : null;
                String pkg = (url == null) ? packageName : null;
                // 自动填入 App 名称作为 description
                String appLabel = null;
                if (pkg != null) {
                    try {
                        appLabel = getPackageManager()
                            .getApplicationLabel(getPackageManager().getApplicationInfo(pkg, 0)).toString();
                    } catch (Exception ignored) {}
                }
                String encDesc = (appLabel != null) ? aesGcmEncrypt(appLabel, aesKey) : null;
                db.execSQL(
                    "INSERT INTO entries (id,type,folder,tags,createdAt,updatedAt,codename,description,url,appPackage) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    new Object[]{id, "password", "", "[]", now, now, encCodename, encDesc, url, pkg});
            }
            // 写入 changelog，让同步引擎感知此变更
            String operation = (targetId != null) ? "update" : "create";
            String deviceId = "unknown";
            Cursor dc = null;
            try {
                dc = db.rawQuery("SELECT value FROM config WHERE key='deviceId'", null);
                if (dc.moveToFirst()) deviceId = dc.getString(0).replaceAll("^\"|\"$", "");
            } catch (Exception ignored) {} finally {
                if (dc != null) try { dc.close(); } catch (Exception ignored) {}
            }
            db.execSQL(
                "INSERT INTO changelog (entryId,entryType,operation,timestamp,synced,deviceId) VALUES (?,?,?,?,?,?)",
                new Object[]{changedId, "entry", operation, System.currentTimeMillis(), 0, deviceId});
        } catch (Exception ignored) {} finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
            if (db != null) try { db.close(); } catch (Exception ignored) {}
        }
    }

    private String aesGcmEncrypt(String plaintext, SecretKeySpec key) throws Exception {
        byte[] iv = new byte[12];
        new java.security.SecureRandom().nextBytes(iv);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        byte[] result = new byte[1 + 12 + ct.length];
        result[0] = 0x01;
        System.arraycopy(iv, 0, result, 1, 12);
        System.arraycopy(ct, 0, result, 13, ct.length);
        return android.util.Base64.encodeToString(result, android.util.Base64.NO_WRAP);
    }

    // ==================== 查询匹配条目（全量解密过滤） ====================

    private static class EntryItem {
        String id, codename, description, storedPassword, charsetMode;
        int passwordLength = 16;
    }

    /**
     * url 字段明文存储，可直接 SQL LIKE 匹配
     * codename/description/storedPassword 需 AES-GCM 解密
     */
    private List<EntryItem> queryMatchingEntries() {
        List<EntryItem> result = new ArrayList<>();
        SQLiteDatabase db = null;
        Cursor c = null;
        try {
            db = openDb();
            SecretKeySpec aesKey = new SecretKeySpec(dbKey, "AES");
            if (webDomain != null && !webDomain.isEmpty()) {
                c = db.rawQuery(
                    "SELECT id, codename, description, storedPassword, passwordLength, charsetMode FROM entries WHERE type='password' AND url LIKE ?",
                    new String[]{"%" + webDomain + "%"});
            } else {
                c = db.rawQuery(
                    "SELECT id, codename, description, storedPassword, passwordLength, charsetMode FROM entries WHERE type='password' AND appPackage=?",
                    new String[]{packageName});
            }
            while (c.moveToNext()) {
                try {
                    EntryItem item = new EntryItem();
                    item.id             = c.getString(0);
                    item.codename       = aesGcmDecrypt(c.getString(1), aesKey);
                    String desc = c.getString(2);
                    item.description    = (desc != null && !desc.isEmpty()) ? aesGcmDecrypt(desc, aesKey) : null;
                    String sp = c.getString(3);
                    item.storedPassword = (sp != null && !sp.isEmpty()) ? aesGcmDecrypt(sp, aesKey) : null;
                    item.passwordLength = c.isNull(4) ? 16 : c.getInt(4);
                    item.charsetMode    = c.isNull(5) ? "alphanumeric" : c.getString(5);
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

    // ==================== 密码生成 ====================

    /**
     * 按代号查找已有条目，用于获取其 passwordLength / charsetMode
     * 找不到时返回 null（调用方使用默认值）
     */
    private EntryItem lookupEntryByCodename(String codename) {
        SQLiteDatabase db = null;
        Cursor c = null;
        try {
            db = openDb();
            SecretKeySpec aesKey = new SecretKeySpec(dbKey, "AES");
            c = db.rawQuery(
                "SELECT codename, passwordLength, charsetMode FROM entries WHERE type='password'", null);
            while (c.moveToNext()) {
                try {
                    if (PasswordGenerator.normalizeCodename(codename).equals(
                        PasswordGenerator.normalizeCodename(aesGcmDecrypt(c.getString(0), aesKey))
                    )) {
                        EntryItem item = new EntryItem();
                        item.codename       = codename;
                        item.passwordLength = c.isNull(1) ? 16 : c.getInt(1);
                        item.charsetMode    = c.isNull(2) ? "alphanumeric" : c.getString(2);
                        return item;
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
        finally {
            if (c != null) try { c.close(); } catch (Exception ignored) {}
            if (db != null) try { db.close(); } catch (Exception ignored) {}
        }
        return null;
    }

    /** 调用 FK-DP1 原生共享实现，固定向量与 core/crypto.ts 一致。 */
    private String generatePassword(String codename, int length, String charsetMode) throws Exception {
        byte[] masterKey = FlowerKeyApp.get().getMasterKey();
        return PasswordGenerator.generate(masterKey, codename, length, charsetMode);
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

    private byte[] pbkdf2(String password, String salt) throws Exception {
        KeySpec spec = new PBEKeySpec(
            password.toCharArray(), salt.getBytes(StandardCharsets.UTF_8), ITERATIONS, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private SQLiteDatabase openDb() {
        return SQLiteDatabase.openDatabase(
            getDatabasePath("flowerkeySQLite.db").getPath(), null, SQLiteDatabase.OPEN_READONLY);
    }

    private void updateLastUsed(String id) {
        if (id == null) return;
        SQLiteDatabase db = null;
        try {
            db = SQLiteDatabase.openDatabase(
                getDatabasePath("flowerkeySQLite.db").getPath(), null, SQLiteDatabase.OPEN_READWRITE);
            android.content.ContentValues cv = new android.content.ContentValues();
            cv.put("lastUsedAt", System.currentTimeMillis());
            db.update("entries", cv, "id=?", new String[]{id});
        } catch (Exception ignored) {
        } finally {
            if (db != null) db.close();
        }
    }

    private void returnPassword(String password, String label) {
        RemoteViews rv = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
        rv.setTextViewText(android.R.id.text1, label);
        Dataset.Builder builder = new Dataset.Builder();
        for (AutofillId id : autofillIds) {
            builder.setValue(id, AutofillValue.forText(password), rv);
        }
        Intent reply = new Intent();
        reply.putExtra(android.view.autofill.AutofillManager.EXTRA_AUTHENTICATION_RESULT, builder.build());
        setResult(RESULT_OK, reply);
        finish();
    }

    // ==================== UI 工具 ====================

    private TextView makeTitle(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(COLOR_TEXT);
        tv.setTextSize(17);
        tv.setTypeface(null, Typeface.BOLD);
        tv.setPadding(0, 0, 0, dp(4));
        return tv;
    }

    private android.view.View makeDivider() {
        android.view.View v = new android.view.View(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        lp.setMargins(0, dp(8), 0, dp(8));
        v.setLayoutParams(lp);
        v.setBackgroundColor(COLOR_DIVIDER);
        return v;
    }

    private EditText makeEditText(String hint, boolean password) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setHintTextColor(COLOR_HINT);
        et.setTextColor(COLOR_TEXT);
        et.setTextSize(15);
        if (password) et.setInputType(android.text.InputType.TYPE_CLASS_TEXT |
            android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(COLOR_SURFACE);
        bg.setCornerRadius(dp(8));
        bg.setStroke(dp(1), COLOR_DIVIDER);
        et.setBackground(bg);
        et.setPadding(dp(12), dp(10), dp(12), dp(10));
        return et;
    }

    private Button makeButton(String text, int bgColor, android.view.View.OnClickListener listener) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setTextColor(bgColor == COLOR_ACCENT ? Color.WHITE : COLOR_TEXT);
        btn.setTextSize(14);
        btn.setAllCaps(false);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(bgColor);
        bg.setCornerRadius(dp(10));
        btn.setBackground(bg);
        btn.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btn.setLayoutParams(lp);
        btn.setOnClickListener(listener);
        return btn;
    }

    private android.view.View makeSpacing(int dp) {
        android.view.View v = new android.view.View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(dp)));
        return v;
    }

    private void toast(String msg) { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show(); }
    private int dp(int dp) { return (int) (dp * getResources().getDisplayMetrics().density); }
}
