package com.flowerkey.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AutofillStatePlugin.class);
        registerPlugin(WebDAVPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
