/** STUDENT-EDITABLE: baseline client state contract. The grading contract is behavioral. */
// Dữ liệu điều khiển do Client gửi lên Server mỗi tick khi người chơi thực hiện thao tác bàn phím
export type Action = {seq: number; dx: number; dy: number; cloak: boolean};

// Trạng thái hiện tại của một người chơi do Server đóng gói và gửi về cho Client
export type PlayerState = {id: string; name: string; x: number; y: number; credits: number; radius: number; alive: boolean; invisible: boolean};

// Trạng thái của các hạt vật phẩm xuất hiện trên bản đồ
export type ItemState = {id: number; tier: 'small'|'medium'|'large'; value: number; x: number; y: number; radius: number};

// Cấu trúc bản ghi sự kiện thời gian thực xảy ra trong phòng chơi, phục vụ việc hiển thị nhật ký sự kiện (Game events feed) trên UI
export type GameEvent = {id: number; type: 'join'|'rejoin'|'leave'|'start'|'collect'|'cloak'|'kill'|'finish'; tick: number; actor?: string; target?: string; tier?: string; value?: number; transferred?: number; winner?: string | null; round?: number};

// Ảnh chụp bức tranh toàn cảnh trạng thái thế giới game (Room State) do Server định kỳ phát (broadcast) cho tất cả các Client
export type Snapshot = {type: 'snapshot'; room: string; tick: number; phase: 'waiting'|'running'|'finished'; round: number; winner: string|null; players: PlayerState[]; items: ItemState[]; events: GameEvent[]};

// Gói tin bắt tay (Handshake Response) do Server phản hồi ngay sau khi Client gửi tin nhắn join thành công
export type Welcome = {type: 'welcome'; id: string; room: string; width: number; height: number; tick_rate: number; snapshot_rate: number; room_capacity: number};

// Thông số đầu vào cần cung cấp khi mở kết nối từ Client
export type ConnectionOptions = {name: string; room: string, sessionToken?: string};

/*Mẫu thiết kế Observer Pattern định nghĩa danh sách các hàm Callback nhận sự kiện mạng, đóng vai trò cầu nối dữ liệu từ tầng truyền tải mạng (ClientTransport) sang tầng giao diện người dùng (GameUI)*/
export type NetworkHooks = {onWelcome(message: Welcome): void; onSnapshot(message: Snapshot): void; onPong(rttMs: number): void; onStatus(status: string): void};
