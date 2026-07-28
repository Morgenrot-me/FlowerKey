package com.flowerkey.app;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * 可由 javac/java 独立执行的身份包装跨端固定向量。
 * 密文由 Web Crypto 使用固定测试盐与 IV 生成，用于验证 Android 解包兼容性。
 */
public final class IdentityEnvelopeVectorCheck {
    private static final String CIPHERTEXT =
        "AQABAgMEBQYHCAkKC6OPSRXTE1IiJvoBdENfRnepoPSerhInCLNQrqNeuM8LmhBU/1HkgEPczl0=";

    private IdentityEnvelopeVectorCheck() {}

    public static void main(String[] args) throws Exception {
        byte[] payload = Base64.getDecoder().decode(CIPHERTEXT);
        String identity = IdentityEnvelopeCrypto.decrypt(
            "master-password",
            "00112233445566778899aabbccddeeff",
            payload
        );
        assertEquals("只属于我的身份密语", identity, "Web Crypto envelope");

        boolean wrongPasswordRejected = false;
        try {
            IdentityEnvelopeCrypto.decrypt(
                "wrong-password",
                "00112233445566778899aabbccddeeff",
                payload
            );
        } catch (Exception expected) {
            wrongPasswordRejected = true;
        }
        if (!wrongPasswordRejected) {
            throw new AssertionError("wrong master password must not decrypt identity envelope");
        }

        byte[] wrongVersion = payload.clone();
        wrongVersion[0] = 2;
        boolean wrongVersionRejected = false;
        try {
            IdentityEnvelopeCrypto.decrypt(
                "master-password",
                "00112233445566778899aabbccddeeff",
                wrongVersion
            );
        } catch (Exception expected) {
            wrongVersionRejected = true;
        }
        if (!wrongVersionRejected) {
            throw new AssertionError("unknown envelope version must be rejected");
        }
    }

    private static void assertEquals(String expected, String actual, String label) {
        if (!expected.equals(actual)) {
            throw new AssertionError(
                label + " expected=" + expected + " actual=" + actual
                    + " actualBytes=" + Base64.getEncoder().encodeToString(
                        actual.getBytes(StandardCharsets.UTF_8)
                    )
            );
        }
    }
}
