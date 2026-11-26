"""Student-editable baseline JSON message encoding and input decoding."""
import json

# 1. Giải mã (parse) chuỗi văn bản JSON thô nhận từ mạng thành một Python dict
def decode_message(raw: str) -> dict | None:
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except (ValueError, TypeError):
        return None

# 2. Mã hóa một Python dict thành chuỗi JSON tối ưu dung lượng để phát (broadcast) qua mạng
def encode_message(obj: dict) -> str:
    return json.dumps(obj, separators=(',', ':'), ensure_ascii=False)

# 3. Trích xuất và kiểm tra tính hợp lệ nghiêm ngặt (Strict Input Validation) của gói tin điều khiển từ người chơi
def parse_input(data: dict) -> tuple[int, int, int, bool] | None:
    seq, dx, dy, cloak = (data.get(key) for key in ('seq', 'dx', 'dy', 'cloak'))
    if not isinstance(seq, int) or isinstance(seq, bool) or not 0 <= seq <= 2**53:
        return None
    if not all(isinstance(v, int) and not isinstance(v, bool) and v in (-1, 0, 1) for v in (dx, dy)):
        return None
    if abs(dx) + abs(dy) > 1 or not isinstance(cloak, bool):
        return None
    return seq, dx, dy, cloak
