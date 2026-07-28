package com.flowerkey.app;

import java.nio.charset.StandardCharsets;
import java.security.spec.KeySpec;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * 不依赖 Android Gradle 或 JUnit 的 FK-DP1 固定向量检查器。
 * 可用 javac/java 直接运行，供离线环境验证原生算法。
 */
public final class PasswordGeneratorVectorCheck {

    private static final byte[] ROOT_KEY = hex(
        "6019cedc406025ee960851cc17d7a11266c4a173be71aa1679148614b170a09e"
    );

    private PasswordGeneratorVectorCheck() {}

    public static void main(String[] args) throws Exception {
        assertBytes(
            ROOT_KEY,
            deriveRootKey("correct horse battery staple", "只属于我的身份句")
        );
        assertBytes(
            hex("e92cc6596a33258365b0aeca86d5277e01c9d9b38e4f096203c6691694b3ab9c"),
            deriveRootKey("我的记忆密码-甲A", "只属于我的身份句")
        );
        assertPassword("nWH46L86", "微信", 8, "alphanumeric");
        assertPassword("nWH4ML8643UhgxED", "微信", 16, "alphanumeric");
        assertPassword("nWH4M68643UhgxEDONcxrIfACZQYC2Ac", "微信", 32, "alphanumeric");
        assertPassword("Z*M&1{|>", "支付宝", 8, "with_symbols");
        assertPassword("Z1M&7{|WtJ8{-PX>", "支付宝", 16, "with_symbols");
        assertPassword("Z*M&7{|WtJ8{-PX1HF8m4_#>.4&h-3f>", "支付宝", 32, "with_symbols");
        assertPassword("UXOWCqi8siOSpjR7", "GitHub-工作", 16, "alphanumeric");
        assertPassword("UXOWCqi8siOSpjR7", " github-工作 ", 16, "alphanumeric");
    }

    private static byte[] deriveRootKey(String masterPassword, String identitySecret)
        throws Exception {
        KeySpec spec = new PBEKeySpec(
            masterPassword.toCharArray(),
            PasswordGenerator.normalizeIdentitySecret(identitySecret)
                .getBytes(StandardCharsets.UTF_8),
            600_000,
            256
        );
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(spec)
            .getEncoded();
    }

    private static void assertBytes(byte[] expected, byte[] actual) {
        if (expected.length != actual.length) {
            throw new AssertionError("root key length mismatch");
        }
        for (int i = 0; i < expected.length; i++) {
            if (expected[i] != actual[i]) {
                throw new AssertionError("root key mismatch at byte " + i);
            }
        }
    }

    private static void assertPassword(
        String expected,
        String codename,
        int length,
        String mode
    ) throws Exception {
        String actual = PasswordGenerator.generate(ROOT_KEY, codename, length, mode);
        if (!expected.equals(actual)) {
            throw new AssertionError(
                codename + "/" + mode + "/" + length + " expected " + expected + " but was " + actual
            );
        }
    }

    private static byte[] hex(String value) {
        byte[] bytes = new byte[value.length() / 2];
        for (int i = 0; i < value.length(); i += 2) {
            bytes[i / 2] = (byte) Integer.parseInt(value.substring(i, i + 2), 16);
        }
        return bytes;
    }
}
