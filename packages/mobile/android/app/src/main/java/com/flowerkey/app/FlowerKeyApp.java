package com.flowerkey.app;

import android.app.Application;

/**
 * 花钥 Application 单例
 * 内存保存解锁状态（dbKey + userSalt），进程内共享，不持久化
 */
public class FlowerKeyApp extends Application {

    private static FlowerKeyApp instance;
    private byte[] dbKey;
    private String userSalt;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    public static FlowerKeyApp get() { return instance; }

    public void setUnlocked(byte[] key, String salt) {
        this.dbKey = key;
        this.userSalt = salt;
    }

    public void setLocked() {
        this.dbKey = null;
        this.userSalt = null;
    }

    public boolean isUnlocked() { return dbKey != null; }
    public byte[] getDbKey() { return dbKey; }
    public String getUserSalt() { return userSalt; }
}
