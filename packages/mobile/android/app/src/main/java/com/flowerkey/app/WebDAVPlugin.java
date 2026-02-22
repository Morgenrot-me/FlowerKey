package com.flowerkey.app;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.util.Iterator;

import okhttp3.*;

/**
 * 原生 WebDAV 插件 - 使用 OkHttp 支持 MKCOL/PROPFIND 等 WebDAV 方法
 */
@CapacitorPlugin(name = "WebDAV")
public class WebDAVPlugin extends Plugin {

    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .build();

    @PluginMethod
    public void request(PluginCall call) {
        String method = call.getString("method", "GET");
        String url = call.getString("url");
        JSObject headers = call.getObject("headers", new JSObject());
        String body = call.getString("body");
        String responseType = call.getString("responseType", "text");

        if (url == null) { call.reject("url required"); return; }

        Request.Builder rb = new Request.Builder().url(url);

        // 设置请求头
        if (headers != null) {
            Iterator<String> keys = headers.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                String val = headers.getString(key);
                if (val != null) rb.header(key, val);
            }
        }

        // 构建请求体
        RequestBody reqBody = null;
        if (body != null && !body.isEmpty()) {
            String ct = headers != null ? headers.getString("Content-Type") : null;
            if (ct != null && ct.contains("octet-stream")) {
                reqBody = RequestBody.create(Base64.decode(body, Base64.DEFAULT),
                    MediaType.parse("application/octet-stream"));
            } else {
                reqBody = RequestBody.create(body.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    ct != null ? MediaType.parse(ct) : MediaType.parse("text/plain"));
            }
        } else if (!method.equals("GET") && !method.equals("HEAD") && !method.equals("DELETE")) {
            reqBody = RequestBody.create(new byte[0], null);
        }

        rb.method(method, reqBody);

        client.newCall(rb.build()).enqueue(new Callback() {
            @Override public void onFailure(Call c, IOException e) { call.reject(e.getMessage()); }

            @Override public void onResponse(Call c, Response res) throws IOException {
                JSObject result = new JSObject();
                result.put("status", res.code());
                ResponseBody resBody = res.body();
                if (resBody != null) {
                    if ("base64".equals(responseType)) {
                        result.put("data", Base64.encodeToString(resBody.bytes(), Base64.NO_WRAP));
                    } else {
                        result.put("data", resBody.string());
                    }
                } else {
                    result.put("data", "");
                }
                res.close();
                call.resolve(result);
            }
        });
    }
}
