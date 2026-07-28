package com.flowerkey.app;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.spec.KeySpec;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥身份密语包装信封的 Android 原生解包实现。
 * 格式与 core/crypto.ts 一致：[1B version][12B IV][ciphertext + 16B GCM tag]。
 */
final class IdentityEnvelopeCrypto {
    private static final int ITERATIONS = 600_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int ENVELOPE_VERSION = 1;
    private static final int IV_LENGTH = 12;
    private static final int HEADER_LENGTH = 1 + IV_LENGTH;
    private static final int GCM_TAG_BITS = 128;
    private static final String SALT_PREFIX = "flowerkey_identity_wrap_";

    private IdentityEnvelopeCrypto() {}

    static String decrypt(String masterPassword, String kdfSalt, byte[] payload)
        throws GeneralSecurityException {
        if (payload == null || payload.length < HEADER_LENGTH + 16) {
            throw new GeneralSecurityException("身份密语包装数据格式错误");
        }
        if ((payload[0] & 0xFF) != ENVELOPE_VERSION) {
            throw new GeneralSecurityException("不支持的身份密语包装版本");
        }

        byte[] iv = Arrays.copyOfRange(payload, 1, HEADER_LENGTH);
        byte[] ciphertext = Arrays.copyOfRange(payload, HEADER_LENGTH, payload.length);
        char[] passwordChars = masterPassword.toCharArray();
        PBEKeySpec spec = new PBEKeySpec(
            passwordChars,
            (SALT_PREFIX + kdfSalt).getBytes(StandardCharsets.UTF_8),
            ITERATIONS,
            KEY_LENGTH_BITS
        );
        try {
            byte[] keyBytes = SecretKeyFactory
                .getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec)
                .getEncoded();
            try {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv)
                );
                return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
            } finally {
                Arrays.fill(keyBytes, (byte) 0);
            }
        } finally {
            spec.clearPassword();
            Arrays.fill(passwordChars, '\0');
        }
    }
}
