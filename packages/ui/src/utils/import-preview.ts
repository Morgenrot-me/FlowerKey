/**
 * 花钥 - 导入预览工具
 * 页面层只负责尽力统计 entries 数量，不能抢先抛出解析错误。
 */
export function getImportEntryCount(json: string): number {
  try {
    const parsed = JSON.parse(json) as { entries?: unknown[] };
    return Array.isArray(parsed.entries) ? parsed.entries.length : 0;
  } catch {
    return 0;
  }
}
