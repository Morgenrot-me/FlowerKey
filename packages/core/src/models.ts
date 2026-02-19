/**
 * 花钥 FlowerKey - 数据模型定义
 * 定义所有核心数据结构：条目、变更日志、同步状态、用户配置
 */

/** 条目类型 */
export type EntryType = 'password' | 'bookmark' | 'file_ref';

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

  // 密码条目字段
  codename?: string;
  salt?: string;
  charsetMode?: CharsetMode;
  passwordLength?: number;

  // 书签条目字段
  url?: string;
  title?: string;
  favicon?: string;

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

/** 用户主密码验证数据（本地存储） */
export interface MasterPasswordData {
  verifyHash: string;
  userSalt: string;       // 密码生成盐（固定，跨设备一致）
  verifySalt?: string;    // 验证专用随机盐（防彩虹表，仅本地）
  createdAt: number;
}
