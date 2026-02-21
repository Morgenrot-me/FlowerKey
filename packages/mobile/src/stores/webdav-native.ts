/**
 * 花钥移动端 - 原生 WebDAV 后端
 * 使用 CapacitorHttp 原生 API 发送请求，绕过 WebView CORS 限制和 Authorization 头限制
 */

import { CapacitorHttp } from '@capacitor/core';
import type { StorageBackend } from '@flowerkey/core';
import type { WebDAVConfig } from '@flowerkey/core';

export class NativeWebDAVBackend implements StorageBackend {
  private base: string;
  private serverUrl: string;
  private authHeader: string;

  constructor(config: WebDAVConfig) {
    this.serverUrl = config.url.replace(/\/$/, '');
    this.base = (config.basePath || '/FlowerKey').replace(/\/$/, '');
    // Basic 认证头
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  private url(name: string) {
    return `${this.serverUrl}${this.base}/${name}`;
  }

  private get headers() {
    return { Authorization: this.authHeader };
  }

  async ensureDir(): Promise<void> {
    for (const path of [this.base, `${this.base}/oplog`]) {
      try {
        await CapacitorHttp.request({
          method: 'MKCOL',
          url: `${this.serverUrl}${path}`,
          headers: this.headers,
        });
      } catch { /* 目录已存在时忽略 */ }
    }
  }

  async read(name: string): Promise<ArrayBuffer | null> {
    try {
      const res = await CapacitorHttp.request({
        method: 'GET',
        url: this.url(name),
        headers: this.headers,
        responseType: 'arraybuffer',
      });
      if (res.status === 404) return null;
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      // CapacitorHttp arraybuffer 返回 base64 string
      const data = res.data as string;
      const binary = atob(data);
      const buf = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
      return buf.buffer as ArrayBuffer;
    } catch (e: unknown) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  }

  async write(name: string, data: ArrayBuffer | string): Promise<void> {
    let b64: string;
    if (typeof data === 'string') {
      b64 = btoa(unescape(encodeURIComponent(data)));
    } else {
      b64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    const res = await CapacitorHttp.request({
      method: 'PUT',
      url: this.url(name),
      headers: { ...this.headers, 'Content-Type': 'application/octet-stream' },
      data: b64,
    });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  }

  async listOplog(): Promise<string[]> {
    try {
      const res = await CapacitorHttp.request({
        method: 'PROPFIND',
        url: `${this.serverUrl}${this.base}/oplog/`,
        headers: { ...this.headers, Depth: '1', 'Content-Type': 'application/xml' },
        data: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><resourcetype/><getlastmodified/></prop></propfind>',
      });
      if (res.status >= 400) return [];
      // 解析 XML 提取文件名
      const xml = res.data as string;
      const matches = [...xml.matchAll(/<[^:]*:?href[^>]*>([^<]+)<\/[^:]*:?href>/gi)];
      return matches
        .map(m => decodeURIComponent(m[1].split('/').pop() || ''))
        .filter(name => name && name.includes('_') && name.endsWith('.enc'))
        .sort();
    } catch {
      return [];
    }
  }

  async remove(name: string): Promise<void> {
    try {
      await CapacitorHttp.request({
        method: 'DELETE',
        url: this.url(name),
        headers: this.headers,
      });
    } catch { /* 忽略不存在的文件 */ }
  }
}
