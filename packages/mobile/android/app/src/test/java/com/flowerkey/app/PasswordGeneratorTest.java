package com.flowerkey.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;

import org.junit.Test;

/**
 * FK-DP1 Android 原生实现回归测试。
 * 固定向量必须与 packages/core/src/crypto.test.ts 完全一致。
 */
public class PasswordGeneratorTest {

    private static final byte[] ROOT_KEY = hex(
        "6019cedc406025ee960851cc17d7a11266c4a173be71aa1679148614b170a09e"
    );

    @Test
    public void normalizesAsciiCaseAndUnicodeNfc() throws Exception {
        String expected = PasswordGenerator.generate(ROOT_KEY, "github-é-工作", 16, "alphanumeric");

        assertEquals(
            expected,
            PasswordGenerator.generate(ROOT_KEY, "GitHub-e\u0301-工作", 16, "alphanumeric")
        );
        assertEquals(
            expected,
            PasswordGenerator.generate(ROOT_KEY, " GITHUB-é-工作 ", 16, "alphanumeric")
        );
        assertNotEquals(
            expected,
            PasswordGenerator.generate(ROOT_KEY, "github-é-工作2", 16, "alphanumeric")
        );
    }

    @Test
    public void normalizesIdentitySecretWithNfcAndPreservesCase() {
        assertEquals(
            PasswordGenerator.normalizeIdentitySecret("身份-é-A"),
            PasswordGenerator.normalizeIdentitySecret("身份-e\u0301-A")
        );
        assertNotEquals(
            PasswordGenerator.normalizeIdentitySecret("身份-é-A"),
            PasswordGenerator.normalizeIdentitySecret("身份-é-a")
        );
    }

    @Test
    public void usesFrozenEcmaScriptWhitespaceSet() {
        assertEquals("github", PasswordGenerator.normalizeCodename("\u3000GitHub\u00a0"));
        assertEquals(
            "\u001cgithub\u001c",
            PasswordGenerator.normalizeCodename("\u001cGitHub\u001c")
        );
    }

    @Test
    public void matchesFrozenFkDp1Vectors() throws Exception {
        assertEquals("nWH46L86", PasswordGenerator.generate(ROOT_KEY, "微信", 8, "alphanumeric"));
        assertEquals("nWH4ML8643UhgxED", PasswordGenerator.generate(ROOT_KEY, "微信", 16, "alphanumeric"));
        assertEquals(
            "nWH4M68643UhgxEDONcxrIfACZQYC2Ac",
            PasswordGenerator.generate(ROOT_KEY, "微信", 32, "alphanumeric")
        );
        assertEquals("Z*M&1{|>", PasswordGenerator.generate(ROOT_KEY, "支付宝", 8, "with_symbols"));
        assertEquals("Z1M&7{|WtJ8{-PX>", PasswordGenerator.generate(ROOT_KEY, "支付宝", 16, "with_symbols"));
        assertEquals(
            "Z*M&7{|WtJ8{-PX1HF8m4_#>.4&h-3f>",
            PasswordGenerator.generate(ROOT_KEY, "支付宝", 32, "with_symbols")
        );
        assertEquals(
            "UXOWCqi8siOSpjR7",
            PasswordGenerator.generate(ROOT_KEY, "GitHub-工作", 16, "alphanumeric")
        );
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsUnsupportedLength() throws Exception {
        PasswordGenerator.generate(ROOT_KEY, "微信", 24, "alphanumeric");
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsUnsupportedMode() throws Exception {
        PasswordGenerator.generate(ROOT_KEY, "微信", 16, "invalid");
    }

    @Test(expected = IllegalArgumentException.class)
    public void rejectsEmptyCodename() throws Exception {
        PasswordGenerator.generate(ROOT_KEY, "　", 16, "alphanumeric");
    }

    private static byte[] hex(String value) {
        byte[] bytes = new byte[value.length() / 2];
        for (int i = 0; i < value.length(); i += 2) {
            bytes[i / 2] = (byte) Integer.parseInt(value.substring(i, i + 2), 16);
        }
        return bytes;
    }
}
