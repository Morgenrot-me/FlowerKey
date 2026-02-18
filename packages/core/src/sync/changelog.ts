/**
 * 花钥 FlowerKey - 变更日志管理
 * 序列化/反序列化 ChangeLog 用于网络传输
 */

import type { ChangeLog } from '../models.js';

export interface OpLogEntry {
  entryId: string;
  entryType: ChangeLog['entryType'];
  operation: ChangeLog['operation'];
  timestamp: number;
  deviceId: string;
  payload?: unknown; // create/update 时携带完整 Entry 数据
}

export function serializeOpLog(logs: OpLogEntry[]): string {
  return JSON.stringify(logs);
}

export function deserializeOpLog(data: string): OpLogEntry[] {
  return JSON.parse(data) as OpLogEntry[];
}
