/**
 * 花钥 FlowerKey - 同步存储后端接口
 * WebDAV 和 iCloud 均实现此接口
 */

export interface StorageBackend {
  ensureDir(): Promise<void>;
  read(name: string): Promise<ArrayBuffer | null>;
  write(name: string, data: ArrayBuffer | string): Promise<void>;
  listOplog(): Promise<string[]>;
  remove(name: string): Promise<void>;
}
