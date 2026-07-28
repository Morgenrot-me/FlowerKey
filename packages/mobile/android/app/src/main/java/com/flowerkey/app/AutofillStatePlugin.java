package com.flowerkey.app;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Capacitor Plugin：Vue 层解锁后同步 dbKey 到 Application 内存
 * 调用：Capacitor.Plugins.AutofillState.setUnlocked({ masterPwd, userSalt })
 */
@CapacitorPlugin(name = "AutofillState")
public class AutofillStatePlugin extends Plugin {

    private static final int ITERATIONS = 600_000;
    private static final String SALT_DBENC = "flowerkey_dbenc_";

    @PluginMethod
    public void setUnlocked(PluginCall call) {
        String masterPwd = call.getString("masterPwd");
        String userSalt = call.getString("userSalt");
        if (masterPwd == null || userSalt == null) { call.reject("missing params"); return; }
        try {
            byte[] dbKey = pbkdf2(masterPwd, SALT_DBENC + userSalt);
            byte[] masterKey = pbkdf2(
                masterPwd,
                PasswordGenerator.normalizeIdentitySecret(userSalt)
            );
            FlowerKeyApp.get().setUnlocked(dbKey, masterKey, userSalt);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void setLocked(PluginCall call) {
        FlowerKeyApp.get().setLocked();
        call.resolve();
    }

    /** 检测系统自动填充服务是否已设置为花钥 */
    @PluginMethod
    public void checkEnabled(PluginCall call) {
        String current = Settings.Secure.getString(getContext().getContentResolver(), "autofill_service");
        ComponentName service = new ComponentName(getContext(), FlowerKeyAutofillService.class);
        boolean enabled = service.flattenToString().equals(current) || service.flattenToShortString().equals(current);
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }

    /** 跳转系统自动填充设置页 */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
        intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(intent);
        call.resolve();
    }

    private byte[] pbkdf2(String password, String salt) throws Exception {
        KeySpec spec = new PBEKeySpec(
            password.toCharArray(), salt.getBytes(StandardCharsets.UTF_8), ITERATIONS, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
    }
}
