/** STUDENT-EDITABLE: baseline JSON message encoding and decoding. */
import type { Action, Snapshot, Welcome } from '../core/contracts';

// Khai báo kiểu hợp (Discriminated Union Type) đại diện cho tất cả các loại gói tin hợp lệ mà Client có thể nhận được từ Server
export type ServerMessage = Welcome | Snapshot | { type: 'pong'; nonce: number } | { type: 'error'; message: string };

export function encodeInput(action: Action): string {
  return JSON.stringify({ type: 'input', ...action });
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (data === null || typeof data !== 'object' || !('type' in data)) return null;
    const record = data as Record<string, unknown>;
    if (record.type === 'welcome' && typeof record.id === 'string') return record as Welcome;
    if (record.type === 'snapshot' && typeof record.tick === 'number' && Array.isArray(record.players)) return record as Snapshot;
    if (record.type === 'pong' && typeof record.nonce === 'number') return { type: 'pong', nonce: record.nonce };
    if (record.type === 'error' && typeof record.message === 'string') return { type: 'error', message: record.message };
    return null;
  } catch { return null; }
}
