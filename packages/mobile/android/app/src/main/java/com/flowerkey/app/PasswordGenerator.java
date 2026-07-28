package com.flowerkey.app;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * 花钥 FK-DP1 Android 原生密码生成器。
 *
 * 此实现服务于系统 AutofillService，必须与 packages/core/src/crypto.ts
 * 及根目录《密码生成协议.md》保持逐字节一致。
 */
final class PasswordGenerator {

    private static final String CHARSET_ALPHANUM =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final String SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?";
    private static final String CHARSET_SYMBOLS = CHARSET_ALPHANUM + SYMBOLS;
    private static final String LETTERS =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String DIGITS = "0123456789";

    private PasswordGenerator() {}

    static String normalizeIdentitySecret(String identitySecret) {
        return Normalizer.normalize(identitySecret, Normalizer.Form.NFC);
    }

    static String normalizeCodename(String codename) {
        String trimmed = trimProtocolWhitespace(codename);
        String normalized = Normalizer.normalize(trimmed, Normalizer.Form.NFC);
        StringBuilder result = new StringBuilder(normalized.length());
        for (int i = 0; i < normalized.length(); i++) {
            char value = normalized.charAt(i);
            result.append(value >= 'A' && value <= 'Z' ? (char) (value + ('a' - 'A')) : value);
        }
        return result.toString();
    }

    static String generate(byte[] rootKey, String codename, int length, String charsetMode)
        throws Exception {
        if (!"alphanumeric".equals(charsetMode) && !"with_symbols".equals(charsetMode)) {
            throw new IllegalArgumentException("FK-DP1不支持该密码类型");
        }
        if (length != 8 && length != 16 && length != 32) {
            throw new IllegalArgumentException("FK-DP1仅支持8、16或32位密码");
        }

        String normalizedCodename = normalizeCodename(codename);
        if (normalizedCodename.isEmpty()) {
            throw new IllegalArgumentException("区分代号不能为空");
        }
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(rootKey, "HmacSHA256"));
        byte[] raw = mac.doFinal(normalizedCodename.getBytes(StandardCharsets.UTF_8));
        mac.init(new SecretKeySpec(rootKey, "HmacSHA256"));
        byte[] mix = mac.doFinal((normalizedCodename + "_mix").getBytes(StandardCharsets.UTF_8));

        boolean withSymbols = "with_symbols".equals(charsetMode);
        String charset = withSymbols ? CHARSET_SYMBOLS : CHARSET_ALPHANUM;
        char[] output = new char[length];
        for (int i = 0; i < length; i++) {
            output[i] = charset.charAt((raw[i % raw.length] & 0xFF) % charset.length());
        }

        output[0] = LETTERS.charAt((mix[0] & 0xFF) % LETTERS.length());
        int digitPosition = 1 + ((mix[1] & 0xFF) % (length - 1));
        output[digitPosition] = DIGITS.charAt((mix[2] & 0xFF) % DIGITS.length());

        if (withSymbols) {
            int symbolPosition = length - 1;
            if (symbolPosition == digitPosition) symbolPosition--;
            if (symbolPosition == 0) symbolPosition = digitPosition == 1 ? 2 : 1;
            output[symbolPosition] = SYMBOLS.charAt((mix[3] & 0xFF) % SYMBOLS.length());
        }
        return new String(output);
    }

    /** 使用 FK-DP1 冻结的 ECMAScript trim 空白码点表，不依赖 Android Unicode 版本。 */
    private static String trimProtocolWhitespace(String value) {
        int start = 0;
        int end = value.length();
        while (start < end) {
            int codePoint = value.codePointAt(start);
            if (!isProtocolWhitespace(codePoint)) break;
            start += Character.charCount(codePoint);
        }
        while (start < end) {
            int codePoint = value.codePointBefore(end);
            if (!isProtocolWhitespace(codePoint)) break;
            end -= Character.charCount(codePoint);
        }
        return value.substring(start, end);
    }

    private static boolean isProtocolWhitespace(int codePoint) {
        return codePoint == 0x0009
            || codePoint == 0x000A
            || codePoint == 0x000B
            || codePoint == 0x000C
            || codePoint == 0x000D
            || codePoint == 0x0020
            || codePoint == 0x00A0
            || codePoint == 0x1680
            || (codePoint >= 0x2000 && codePoint <= 0x200A)
            || codePoint == 0x2028
            || codePoint == 0x2029
            || codePoint == 0x202F
            || codePoint == 0x205F
            || codePoint == 0x3000
            || codePoint == 0xFEFF;
    }
}
