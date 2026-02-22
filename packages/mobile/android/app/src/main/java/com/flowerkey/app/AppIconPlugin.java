package com.flowerkey.app;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    private static final String PKG = "com.flowerkey.app";
    private static final String ALIAS_BLUE = PKG + ".IconBlue";
    private static final String ALIAS_GOLD = PKG + ".IconGold";

    /** 切换图标：icon = "blue" | "gold" */
    @PluginMethod
    public void setIcon(PluginCall call) {
        String icon = call.getString("icon", "blue");
        PackageManager pm = getContext().getPackageManager();

        String enable  = "gold".equals(icon) ? ALIAS_GOLD : ALIAS_BLUE;
        String disable = "gold".equals(icon) ? ALIAS_BLUE  : ALIAS_GOLD;

        pm.setComponentEnabledSetting(
            new ComponentName(PKG, enable),
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            PackageManager.DONT_KILL_APP
        );
        pm.setComponentEnabledSetting(
            new ComponentName(PKG, disable),
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        );

        JSObject ret = new JSObject();
        ret.put("icon", icon);
        call.resolve(ret);
    }

    /** 获取当前图标 */
    @PluginMethod
    public void getIcon(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        int state = pm.getComponentEnabledSetting(new ComponentName(PKG, ALIAS_GOLD));
        String current = (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) ? "gold" : "blue";
        JSObject ret = new JSObject();
        ret.put("icon", current);
        call.resolve(ret);
    }
}
