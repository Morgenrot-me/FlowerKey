import { registerPlugin } from '@capacitor/core';
import type { StorageBackend, WebDAVConfig } from '@flowerkey/core';

const WebDAV = registerPlugin<{
  request(options: {
    method: string; url: string;
    headers?: Record<string, string>;
    body?: string;
    responseType?: 'text' | 'base64';
  }): Promise<{ status: number; data: string }>;
}>('WebDAV');

export class NativeWebDAVBackend implements StorageBackend {
  private base: string;
  private serverUrl: string;
  private authHeader: string;

  constructor(config: WebDAVConfig) {
    this.serverUrl = config.url.replace(/\/$/, '');
    const raw = (config.basePath || '/FlowerKey').replace(/\/$/, '');
    this.base = raw.startsWith('/') ? raw : '/' + raw;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.password}`);
  }

  private buildUrl(name: string) {
    return `${this.serverUrl}${this.base}/${name}`;
  }

  private get auth() {
    return { Authorization: this.authHeader };
  }

  private async req(method: string, url: string, opts: {
    headers?: Record<string, string>;
    body?: string;
    responseType?: 'text' | 'base64';
  } = {}) {
    return WebDAV.request({ method, url, ...opts });
  }

  async ensureDir(): Promise<void> {
    for (const path of [this.base, `${this.base}/oplog`]) {
      const url = `${this.serverUrl}${path}`;
      const res = await this.req('MKCOL', url, { headers: this.auth });
      if (res.status >= 400 && res.status !== 405) {
        throw new Error(`创建目录失败：${path} HTTP ${res.status}`);
      }
    }
  }

  async read(name: string): Promise<ArrayBuffer | null> {
    const res = await this.req('GET', this.buildUrl(name), {
      headers: this.auth, responseType: 'base64',
    });
    if (res.status === 404 || res.status === 410) return null;
    if (res.status >= 400) throw new Error(`GET ${name} 失败：HTTP ${res.status}`);
    const binary = atob(res.data);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer as ArrayBuffer;
  }

  async write(name: string, data: ArrayBuffer | string): Promise<void> {
    const b64 = typeof data === 'string'
      ? btoa(unescape(encodeURIComponent(data)))
      : btoa(String.fromCharCode(...new Uint8Array(data)));
    const doput = () => this.req('PUT', this.buildUrl(name), {
      headers: { ...this.auth, 'Content-Type': 'application/octet-stream' },
      body: b64,
    });
    let res = await doput();
    if (res.status === 409 || res.status === 410) {
      await this.ensureDir();
      res = await doput();
    }
    if (res.status >= 400) throw new Error(`PUT ${name} 失败：HTTP ${res.status}`);
  }

  async listOplog(): Promise<string[]> {
    const res = await this.req('PROPFIND', `${this.serverUrl}${this.base}/oplog/`, {
      headers: { ...this.auth, Depth: '1', 'Content-Type': 'application/xml' },
      body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>',
    });
    if (res.status >= 400) return [];
    const matches = [...res.data.matchAll(/<[^:]*:?href[^>]*>([^<]+)<\/[^:]*:?href>/gi)];
    return matches
      .map(m => decodeURIComponent(m[1].split('/').pop() || ''))
      .filter(n => n && n.includes('_') && n.endsWith('.enc'))
      .sort();
  }

  async remove(name: string): Promise<void> {
    await this.req('DELETE', this.buildUrl(name), { headers: this.auth }).catch(() => {});
  }
}
