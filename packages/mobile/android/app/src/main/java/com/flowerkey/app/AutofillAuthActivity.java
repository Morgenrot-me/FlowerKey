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
    private int COLOR_ITEM;

    private void initColors() {
        boolean dark = (getResources().getConfiguration().uiMode
            & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        if (dark) {
            COLOR_BG      = 0xFF1E1E2E;
            COLOR_SURFACE = 0xFF2A2A3E;
            COLOR_ACCENT  = 0xFF60A5FA;
            COLOR_TEXT    = 0xFFE0E0F0;
            COLOR_HINT    = 0xFF888899;
            COLOR_DIVIDER = 0xFF3A3A50;
            COLOR_ITEM    = 0xFF35354A;
        } else {
            COLOR_BG      = 0xFFF5F5F7;
            COLOR_SURFACE = 0xFFFFFFFF;
            COLOR_ACCENT  = 0xFF3B82F6;
            COLOR_TEXT    = 0xFF1A1A2E;
            COLOR_HINT    = 0xFF888899;
            COLOR_DIVIDER = 0xFFDDDDE8;
            COLOR_ITEM    = 0xFFF2F3F7;
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
        scroll.setFillViewport(true);

        LinearLayout outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setGravity(Gravity.CENTER);
        outer.setLayoutParams(new ScrollView.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT));

        layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(20), dp(20), dp(20));
        int screenW = getResources().getDisplayMetrics().widthPixels;
        int cardW = Math.min(dp(420), screenW - dp(32));
        layout.setLayoutParams(new LinearLayout.LayoutParams(cardW, LinearLayout.LayoutParams.WRAP_CONTENT));

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(COLOR_SURFACE);
        cardBg.setCornerRadius(dp(20));
        layout.setBackground(cardBg);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            layout.setElevation(dp(6));
        }

        outer.addView(layout);
        scroll.addView(outer);
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
        addHeader("自动填充密码");

        etMaster = makeEditText("主密码", true);
        layout.addView(etMaster);
        layout.addView(makeSpacing(10));

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

            if (data.optInt("formatVersion", 0) != 1) {
                toast("检测到发布前旧数据，请清空应用数据后重新初始化");
                return;
            }
            String verifySalt = data.getString("verifySalt");
            String storedHash = data.getString("verifyHash");

            byte[] hash = pbkdf2(pwd, SALT_VERIFY + verifySalt);
            if (!toHex(hash).equals(storedHash)) { toast("主密码错误"); return; }

            JSONObject envelope = data.getJSONObject("identityEnvelope");
            if (envelope.getInt("version") != 1) {
                toast("不支持的身份密语包装版本");
                return;
            }
            byte[] wrappedIdentity = android.util.Base64.decode(
                envelope.getString("ciphertext"),
                android.util.Base64.DEFAULT
            );
            try {
                userSalt = IdentityEnvelopeCrypto.decrypt(
                    pwd,
                    envelope.getString("kdfSalt"),
                    wrappedIdentity
                );
            } catch (java.security.GeneralSecurityException e) {
                toast("身份密语包装数据损坏");
                return;
            }
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
        addHeader("选择条目并填充");

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
        tvPreview.setVisibility(android.view.View.GONE);
        GradientDrawable prevBg = new GradientDrawable();
        prevBg.setColor(COLOR_ITEM);
        prevBg.setCornerRadius(dp(10));
        tvPreview.setBackground(prevBg);
        tvPreview.setPadding(dp(10), dp(8), dp(10), dp(8));
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
        row.setPadding(dp(16), dp(14), dp(16), dp(14));
        row.setClickable(true);
        row.setFocusable(true);
        row.setMinimumHeight(dp(56));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(COLOR_ITEM);
        bg.setCornerRadius(dp(14));
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
            tvDesc.setMaxLines(1);
            tvDesc.setEllipsize(android.text.TextUtils.TruncateAt.END);
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
        RemoteViews rv = new RemoteViews(getPackageName(), R.layout.autofill_dataset_item);
        rv.setTextViewText(R.id.label, label);
        rv.setImageViewResource(R.id.icon, R.drawable.ic_key_fill);
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

    private void addHeader(String subtitle) {
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_key_fill);
        icon.setColorFilter(new android.graphics.PorterDuffColorFilter(COLOR_ACCENT, android.graphics.PorterDuff.Mode.SRC_IN));
        int s = dp(28);
        LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(s, s);
        ilp.gravity = Gravity.CENTER_HORIZONTAL;
        layout.addView(icon, ilp);
        layout.addView(makeSpacing(10));

        TextView title = new TextView(this);
        title.setText("花钥");
        title.setTextColor(COLOR_TEXT);
        title.setTextSize(20);
        title.setTypeface(null, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        layout.addView(title);
        layout.addView(makeSpacing(2));

        TextView sub = new TextView(this);
        sub.setText(subtitle);
        sub.setTextColor(COLOR_HINT);
        sub.setTextSize(13);
        sub.setGravity(Gravity.CENTER);
        layout.addView(sub);
        layout.addView(makeSpacing(14));
    }

    private EditText makeEditText(String hint, boolean password) {
        EditText et = new EditText(this);
        et.setHint(hint);
        et.setHintTextColor(COLOR_HINT);
        et.setTextColor(COLOR_TEXT);
        et.setTextSize(15);
        et.setSingleLine(true);
        if (password) et.setInputType(android.text.InputType.TYPE_CLASS_TEXT |
            android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(COLOR_ITEM);
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), COLOR_DIVIDER);
        et.setBackground(bg);
        et.setPadding(dp(14), dp(12), dp(14), dp(12));
        et.setMinHeight(dp(50));
        return et;
    }

    private Button makeButton(String text, int bgColor, android.view.View.OnClickListener listener) {
        Button btn = new Button(this);
        btn.setText(text);
        btn.setTextSize(15);
        btn.setAllCaps(false);
        btn.setMinHeight(dp(50));
        if (bgColor == COLOR_ACCENT) {
            btn.setTextColor(Color.WHITE);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(COLOR_ACCENT);
            bg.setCornerRadius(dp(14));
            btn.setBackground(bg);
        } else {
            btn.setTextColor(COLOR_TEXT);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(0x00000000);
            bg.setCornerRadius(dp(14));
            bg.setStroke(dp(1), COLOR_DIVIDER);
            btn.setBackground(bg);
        }
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

