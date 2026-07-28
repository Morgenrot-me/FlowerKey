/**
 * 花钥 FlowerKey - 数据模型定义
 * 定义所有核心数据结构：条目、变更日志、同步状态、用户配置
 */

/** 条目类型 */
export type EntryType = 'password' | 'bookmark' | 'file_ref' | 'note';

/** 密码输出字符集模式 */
export type CharsetMode = 'alphanumeric' | 'with_symbols';

/** 统一条目模型 */
export interface Entry {
  id: string;
  type: EntryType;
  tags: string[];
  folder: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;  // 最近使用时间（本地记录，不参与同步）

  // 密码条目字段
  codename?: string;
  charsetMode?: CharsetMode;
  passwordLength?: number;
  storedPassword?: string;  // 存储模式：直接加密存储任意密码（与生成模式互斥）
  appPackage?: string;      // 关联 Android App 包名（明文，用于 AutofillService 匹配）

  // 书签条目字段
  url?: string;
  title?: string;
  favicon?: string;
  encrypted?: boolean;  // false = 书签明文存储（不加密）

  // 笔记字段
  content?: string;  // 笔记正文（加密存储）

  // 文件引用字段
  fileName?: string;
  sourceUrl?: string;
}

/** 变更日志 - 增量同步核心 */
export interface ChangeLog {
  id?: number;
  entryId: string;
  entryType: 'entry' | 'config';
  operation: 'create' | 'update' | 'delete';
  timestamp: number;
  synced: boolean;
  deviceId: string;
}

/** 同步状态 */
export interface SyncState {
  key: string;
  lastSyncTime: number;
  lastRemoteETag: string;
  deviceId: string;
}

/** 用户配置 */
export interface UserConfig {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** 身份密语本地包装信封 */
export interface IdentitySecretEnvelope {
  version: 1;
  kdfSalt: string;
  ciphertext: string;
}

/** 用户主密码验证与身份包装数据（本地存储） */
export interface MasterPasswordData {
  formatVersion: 1;
  verifyHash: string;
  verifySalt: string;     // 验证专用随机盐（防彩虹表，仅本地）
  identityEnvelope: IdentitySecretEnvelope;
  createdAt: number;
  // 恢复码加密数据（可选，首次设置或手动生成后存在）
  encryptedMasterPwd?: string;
  recoverySalt?: string;
}
