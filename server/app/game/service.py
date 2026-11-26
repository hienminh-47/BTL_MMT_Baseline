"""Student-editable room/session state and orchestration; do not change the rules."""
from __future__ import annotations
from hashlib import sha256
import re
import uuid
from .engine import World
from .rules import HEIGHT, ROOM_CAPACITY, SNAPSHOT_RATE, TICK_RATE, WIDTH

ROOM_NAME = re.compile(r'^[a-zA-Z0-9_-]{1,20}$')

class GameService:
    # 1. Khởi tạo bộ lưu trữ trạng thái máy chủ
    def __init__(self) -> None:
        self.rooms: dict[str, World] = {}
        self.player_rooms: dict[str, str] = {}
        self.simulator_rooms: set[str] = set()
        # Update: Ánh xạ session_token theo từng phòng: { session_token: { room_name: player_id } }
        self.sessions: dict[str, dict[str, str]] = {}

    # 2. Xử lý yêu cầu tham gia phòng chơi và khôi phục định danh phiên
    def join(self, name: str, room: str, session_token: str | None = None) -> dict:
        if not ROOM_NAME.fullmatch(room):
            raise ValueError('Room must be 1-20 letters, numbers, _ or -')
        name = name.strip()[:18]
        if not name:
            raise ValueError('Player name required')
        if room not in self.rooms:
            seed = int.from_bytes(sha256(room.encode()).digest()[:4], 'big')
            self.rooms[room] = World(room, seed)
        
        #UPDATE: LOGIC ĐỊNH DANH
        player_id = None
        
        # KIỂM TRA ĐỊNH DÀNH THEO PHÒNG (ROOM-SCOPED PERSISTENT IDENTITY)
        if session_token:
            if session_token not in self.sessions:
                self.sessions[session_token] = {}
            
            # Nếu session này đã từng có player_id TRONG CHÍNH PHÒNG NÀY (Trường hợp F5 cùng phòng)
            if room in self.sessions[session_token]:
                player_id = self.sessions[session_token][room]
                print(f"[SERVER LOG] Reused existing player_id: {player_id} for session in room '{room}'")
        
        # Nếu chưa có trong phòng này (Vào phòng mới hoặc session mới) -> Cấp player_id mới cho phòng này
        if not player_id:
            player_id = uuid.uuid4().hex[:12]
            if session_token:
                self.sessions[session_token][room] = player_id
            print(f"[SERVER LOG] Created NEW player_id: {player_id} for room '{room}'")

        world = self.rooms[room]
        
        # Xử lý rời phòng cũ nếu người chơi đang kẹt ở phòng khác
        old_room = self.player_rooms.get(player_id)
        if old_room and old_room != room and old_room in self.rooms:
            self.rooms[old_room].remove_player(player_id)

        # Thêm người chơi vào World (nếu chưa có)
        if player_id not in world.players:
            world.add_player(player_id, name)

        self.player_rooms[player_id] = room
        return {'type': 'welcome', 'id': player_id, 'room': room, 'width': WIDTH,
                'height': HEIGHT, 'tick_rate': TICK_RATE, 'snapshot_rate': SNAPSHOT_RATE,
                'room_capacity': ROOM_CAPACITY}

    # 3. Đăng ký và bảo lưu một phòng dành riêng cho kịch bản mô phỏng
    def start_sim_room(self, room: str) -> None:
        if room in self.rooms:
            raise ValueError('Scenario room already in use')
        seed = int.from_bytes(sha256(room.encode()).digest()[:4], 'big')
        self.rooms[room] = World(room, seed)
        self.simulator_rooms.add(room)

    # 4. Thêm nhân vật kịch bản (actor) vào phòng mô phỏng
    def sim_join(self, actor: str, room: str, run_id: str, name: str) -> dict:
        if room not in self.simulator_rooms:
            raise ValueError('Scenario room is not reserved')
        player_id = f'_sim_{run_id}_{actor}'
        self.rooms[room].add_player(player_id, name)
        self.player_rooms[player_id] = room
        return {'type': 'welcome', 'id': player_id, 'room': room,
                'width': WIDTH, 'height': HEIGHT, 'tick_rate': TICK_RATE,
                'snapshot_rate': SNAPSHOT_RATE, 'room_capacity': ROOM_CAPACITY}

    # 5. Điều phối nâng 1 tick vật lý thủ công cho phòng test (chế độ Lockstep)
    def sim_step(self, room: str) -> dict:
        if room not in self.simulator_rooms or room not in self.rooms:
            raise ValueError('Scenario room unavailable')
        self.rooms[room].step()
        return self.rooms[room].snapshot(reveal_hidden=True)

    # 6. Thu dọn tài nguyên khi kịch bản kết thúc.
    def finish_sim_room(self, room: str) -> None:
        if room in self.simulator_rooms:
            for player_id in list(self.rooms.get(room).players if room in self.rooms else []):
                self.player_rooms.pop(player_id, None)
            self.rooms.pop(room, None)
            self.simulator_rooms.discard(room)

    # 7. Xử lý khi người chơi ngắt kết nối hoặc rời phòng
    def leave(self, player_id: str) -> None:
        room = self.player_rooms.pop(player_id, None)
        if room is not None and room in self.rooms:
            self.rooms[room].remove_player(player_id)
            if not self.rooms[room].players and room not in self.simulator_rooms:
                del self.rooms[room]

    # 8. Xử lý yêu cầu chơi lại (Rejoin) sau khi bị hạ gục
    def rejoin(self, player_id: str) -> bool:
        room = self.player_rooms.get(player_id)
        return self.rooms[room].rejoin(player_id) if room else False

    # 9. Tiếp nhận gói tin điều khiển bàn phím từ Client
    def apply_input(self, player_id: str, seq: int, dx: int, dy: int, cloak: bool) -> bool:
        room = self.player_rooms.get(player_id)
        return self.rooms[room].accept_input(player_id, seq, dx, dy, cloak) if room else False

    # 10. Tạo gói snapshot thông tin môi trường gửi riêng cho từng Client.
    def snapshot_for(self, player_id: str) -> dict | None:
        room = self.player_rooms.get(player_id)
        return self.rooms[room].snapshot(viewer_id=player_id) if room else None

    # 11. Bước tiến thời gian thực định kỳ cho tất cả các phòng chơi thường
    def advance(self) -> dict[str, dict]:
        for room, world in self.rooms.items():
            if room not in self.simulator_rooms:
                world.step()
        return {room: world.snapshot(reveal_hidden=True) for room, world in self.rooms.items()}
