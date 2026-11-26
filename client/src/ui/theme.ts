import type { ItemState } from '../core/contracts';
import type { ConnectionState } from './game';

export type Tier = ItemState['tier'];

export const RULES = {
  cloakSeconds: 3,
  cloakCost: 5,
  decayPercent: 2,
  decaySeconds: 5,
  killPercent: 40,
} as const;

export const TEXT = {
  appName: 'Cá Lớn Nuốt Cá Bé',
  eyebrow: 'MẠNG MÁY TÍNH · BÀI TẬP LỚN 1',
  tagline: '[PLACEHOLDER_TGLINE]',
  creditName: 'Cân nặng',
  creditUnit: 'kg',
  cloakName: 'Phun mực',
  nameLabel: 'Tên cá',
  roomLabel: 'Phòng',
  defaultName: 'Cá',
  join: 'Vào phòng',
  rejoin: 'Hồi sinh',
  leave: 'Rời phòng',
  idleArena: 'VÀO PHÒNG ĐỂ THẢ CÁ',
  unknownFish: '<placeholder-unknownFish>',
} as const;

export const HOW_TO_PLAY: { term: string; meaning: string }[] = [
  { term: 'Cá', meaning: `Mỗi người chơi là một con cá. ${TEXT.creditName} (${TEXT.creditUnit}) chính là credit.` },
  { term: 'Ăn mồi', meaning: 'Càng nặng thì càng to và bơi càng chậm.' },
  { term: TEXT.cloakName, meaning: `Tàng hình ${RULES.cloakSeconds} giây, tốn ${RULES.cloakCost} ${TEXT.creditUnit}. Vẫn có thể bị nuốt khi đang tàng hình.` },
  { term: 'Nuốt', meaning: `Cá nặng hơn chạm vào cá nhẹ hơn thì nuốt được, nhận ${RULES.killPercent}% cân nặng của con mồi (làm tròn lên). Nặng bằng nhau thì không ai nuốt được ai.` },
  { term: 'Đói', meaning: `Mỗi ${RULES.decaySeconds} giây sụt ${RULES.decayPercent}% cân nặng (làm tròn lên).` },
  { term: TEXT.rejoin, meaning: `Bị nuốt thì nở lại với 0 ${TEXT.creditUnit}.` },
  { term: 'Vua đại dương', meaning: 'Con cá cuối cùng còn sống thắng vòng đó.' },
  { term: 'Viền quanh cá', meaning: 'Xám: nặng bằng nhau. Xanh: Đối thủ nhẹ hơn, có thể nuốt. Đỏ: Quá nặng ký🐧. ' },
];

export const TIERS: Record<Tier, { name: string; value: number; color: string }> = {
  small:  { name: 'Phù du',  value: 1, color: '#9be7d5'},
  medium: { name: 'Tôm',     value: 3, color: '#ff8fa3' },
  large:  { name: 'Bạch tuộc', value: 7, color: '#c39bff' },
};

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối...',
  connected: 'Đã kết nối',
  disconnected: 'Mất kết nối',
  error: 'Lỗi kết nối',
  replaced: 'Đã mở ở tab khác',
};

export const GAME_STATUS = {
  notJoined: 'Vào phòng để bắt đầu',
  waiting: 'Đang chờ thêm ít nhất một con cá nữa...',
  running: (round: number) => `Vòng ${round}: đang săn mồi`,
  eliminated: 'Bạn đã bị nuốt. Bấm Hồi sinh để nở lại',
  won: 'Bạn là Vua đại dương!',
  finished: 'Vòng đã kết thúc. Bấm Hồi sinh để chơi vòng mới',
};

export const CANVAS = {
  waterTop: '#1c3b41',
  waterBottom: '#0f2327',
  bubble: 'rgba(255,255,255,0.16)',
  idleText: '#d6eef2',
  me: '#ffc247',               // cá của mình: vàng
  rival: '#6fb7ff',            // cá người khác: xanh
  outline: 'rgba(0,0,0,0.35)',
  eye: '#0b1a22',
  ink: 'rgba(16,8,32,0.45)',   // mây mực khi đang phun mực
  prey: '#5ee6a8',             // viền: nhẹ hơn mình, nuốt được
  danger: '#ff5d73',           // viền: nặng hơn mình, nên tránh
  even: '#d6e4ea',             // viền: nặng bằng nhau
  label: '#ffffff',
  labelShadow: 'rgba(0,0,0,0.55)',
} as const;

export const EFFECTS = {
  floatMs: 900,        // số bay lên (+3, +12)
  ringMs: 450,         // vòng "đớp", vòng phun mực
  bannerMs: 1800,      // chữ lớn giữa màn hình
  maxAgeTicks: 10,     // event cũ hơn 0.5 giây (20 tick/giây) thì không diễn lại
  maxActive: 80,       // giới hạn số hiệu ứng tồn tại cùng lúc
  gain: '#ffe08a',     // số credit nhận được khi nuốt
  chomp: '#ff5d73',    // vòng "đớp"
  ink: '#c9a7ff',      // vòng phun mực
  banner: '#ffffff',
} as const;

export const BANNER = {
  roundStart: (round: number) => `Vòng ${round} bắt đầu!`,
  winner: (name: string) => `${name} là Vua đại dương!`,
  noWinner: 'Không con cá nào sống sót',
};

/** Dữ liệu từ mạng chỉ là string; kiểm tra rồi mới dùng làm Tier. */
export function tierOf(value: string | undefined): Tier | undefined {
  return value === 'small' || value === 'medium' || value === 'large' ? value : undefined;
}
