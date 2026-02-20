/**
 * 花钥 FlowerKey - iCloud Drive 存储适配器
 * 通过 Capacitor Filesystem 插件访问 iCloud Drive（Documents 目录）
 * 仅在 iOS 平台可用
 */

import type { StorageBackend } from '@flowerkey/core';

// 运行时动态导入 Capacitor，避免在非移动端环境报错
async function getFs() {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  return { Filesystem, Directory, Encoding };
}

export class ICloudBackend implements StorageBackend {
  private base: string;

  constructor(basePath = 'FlowerKey') {
    this.base = basePath.replace(/^\//, '');
  }

  private path(name: string) {
    return `${this.base}/${name}`;
  }

  async ensureDir(): Promise<void> {
    const { Filesystem, Directory } = await getFs();
    for (const dir of [this.base, `${this.base}/oplog`]) {
      try {
        await Filesystem.mkdir({ path: dir, directory: Directory.Documents, recursive: true });
      } catch {
        // 目录已存在时忽略
      }
    }
  }

  async read(name: string): Promise<ArrayBuffer | null> {
    const { Filesystem, Directory } = await getFs();
    try {
      const result = await Filesystem.readFile({
        path: this.path(name),
        directory: Directory.Documents,
      });
      // result.data 可能是 base64 string 或 Blob
      const data = result.data;
      if (typeof data === 'string') {
        const binary = atob(data);
        const buf = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
        return buf.buffer as ArrayBuffer;
      }
      // Blob
      return await (data as Blob).arrayBuffer();
    } catch {
      return null;
    }
  }

  async write(name: string, data: ArrayBuffer | string): Promise<void> {
    const { Filesystem, Directory } = await getFs();
    let b64: string;
    if (typeof data === 'string') {
      b64 = btoa(unescape(encodeURIComponent(data)));
    } else {
      b64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    await Filesystem.writeFile({
      path: this.path(name),
      data: b64,
      directory: Directory.Documents,
      recursive: true,
    });
  }

  async listOplog(): Promise<string[]> {
    const { Filesystem, Directory } = await getFs();
    try {
      const result = await Filesystem.readdir({
        path: `${this.base}/oplog`,
        directory: Directory.Documents,
      });
      return result.files
        .filter((f: { type: string }) => f.type === 'file')
        .map((f: { name: string }) => f.name)
        .sort();
    } catch {
      return [];
    }
  }

  async remove(name: string): Promise<void> {
    const { Filesystem, Directory } = await getFs();
    try {
      await Filesystem.deleteFile({ path: this.path(name), directory: Directory.Documents });
    } catch {
      // 忽略不存在的文件
    }
  }
}
