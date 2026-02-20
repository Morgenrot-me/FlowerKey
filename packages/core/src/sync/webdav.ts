/**
 * 花钥 FlowerKey - WebDAV 客户端封装
 * 提供文件读写、ETag检查、锁机制
 */

import { createClient, type WebDAVClient } from 'webdav';
import type { StorageBackend } from './backend.js';

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  basePath?: string;
}

export class FlowerKeyWebDAV implements StorageBackend {
  private client: WebDAVClient;
  private base: string;

  constructor(config: WebDAVConfig) {
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password,
    });
    this.base = (config.basePath || '/FlowerKey').replace(/\/$/, '');
  }

  private path(name: string) {
    return `${this.base}/${name}`;
  }

  /** 确保基础目录存在 */
  async ensureDir(): Promise<void> {
    try {
      await this.client.createDirectory(this.base, { recursive: true });
    } catch {
      // 目录已存在时忽略
    }
    try {
      await this.client.createDirectory(this.path('oplog'), { recursive: true });
    } catch {
      // 忽略
    }
  }

  /** 读取文件内容（返回 ArrayBuffer，不存在返回 null） */
  async read(name: string): Promise<ArrayBuffer | null> {
    try {
      const buf = await this.client.getFileContents(this.path(name));
      return buf as ArrayBuffer;
    } catch (e: unknown) {
      if ((e as { status?: number }).status === 404) return null;
      throw e;
    }
  }

  /** 写入文件 */
  async write(name: string, data: ArrayBuffer | string): Promise<void> {
    await this.client.putFileContents(this.path(name), data, { overwrite: true });
  }

  /** 获取文件 ETag 或 Last-Modified（用于变更检测） */
  async getETag(name: string): Promise<string | null> {
    try {
      const stat = await this.client.stat(this.path(name));
      if (typeof stat === 'object' && stat !== null) {
        const s = stat as unknown as Record<string, unknown>;
        return (s['etag'] as string) || (s['lastmod'] as string) || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** 列出 oplog 目录下的文件名 */
  async listOplog(): Promise<string[]> {
    try {
      const items = await this.client.getDirectoryContents(this.path('oplog'));
      const arr = Array.isArray(items) ? items : (items as { data: unknown[] }).data;
      return (arr as Array<{ basename: string; type: string }>)
        .filter(i => i.type === 'file')
        .map(i => i.basename)
        .sort();
    } catch {
      return [];
    }
  }

  /** 删除文件 */
  async remove(name: string): Promise<void> {
    try {
      await this.client.deleteFile(this.path(name));
    } catch {
      // 忽略不存在的文件
    }
  }
}
