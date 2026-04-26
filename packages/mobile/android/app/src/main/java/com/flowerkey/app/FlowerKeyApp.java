package com.flowerkey.app;

import android.app.Application;
import java.util.Arrays;

/**
 * 花钥 Application 单例
 * 内存保存解锁状态（dbKey + masterKey + userSalt），进程内共享，不持久化
 * 所有方法 synchronized 保证多线程安全；锁定时主动清零密钥字节
 */
public class FlowerKeyApp extends Application {

    private static FlowerKeyApp instance;
    private byte[] dbKey;
    private byte[] masterKey;
    private String userSalt;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    public static FlowerKeyApp get() { return instance; }

    public synchronized void setUnlocked(byte[] dbKey, byte[] masterKey, String salt) {
        setLocked();
        this.dbKey = dbKey == null ? null : Arrays.copyOf(dbKey, dbKey.length);
        this.masterKey = masterKey == null ? null : Arrays.copyOf(masterKey, masterKey.length);
        this.userSalt = salt;
    }

    public synchronized void setLocked() {
        if (dbKey != null)     { Arrays.fill(dbKey, (byte) 0);     dbKey = null; }
        if (masterKey != null) { Arrays.fill(masterKey, (byte) 0); masterKey = null; }
        userSalt = null;
    }

    public synchronized boolean isUnlocked() { return dbKey != null; }

    /** 返回防御性副本，防止调用方修改或持有原始引用 */
    public synchronized byte[] getDbKey()     { return dbKey     == null ? null : Arrays.copyOf(dbKey,     dbKey.length); }
    public synchronized byte[] getMasterKey() { return masterKey == null ? null : Arrays.copyOf(masterKey, masterKey.length); }
    public synchronized String getUserSalt()  { return userSalt; }
}
