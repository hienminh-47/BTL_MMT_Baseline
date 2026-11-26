"""INSTRUCTOR-OWNED: application bootstrap, fixed simulation timing and web serving."""
from __future__ import annotations

import asyncio
from contextlib import suppress
import os
from pathlib import Path

from aiohttp import web

from .game.rules import SNAPSHOT_RATE, TICK_RATE
from .game.service import GameService
from .network.transport import GameTransport
from .simulator.transport import SimulatorTransport

FRONTEND_DIST = Path(__file__).resolve().parents[2] / 'client' / 'dist'

# 1. Xử lý endpoint HTTP GET /health
async def health(_request: web.Request) -> web.Response:
    return web.json_response({'status': 'ok', 'game': 'move-collect-tag'})

# 2. Xử lý trang chủ HTTP GET / để phục vụ giao diện trang web
async def index(_request: web.Request) -> web.Response:
    path = FRONTEND_DIST / 'index.html'
    if not path.is_file():
        return web.Response(text='Frontend not built. Run: cd client && npm run dev', content_type='text/plain')
    return web.FileResponse(path)

# 3. Quản lý vòng đời chạy background task (Simulation Loop) và đóng tài nguyên an toàn khi tắt máy chủ
async def lifecycle(app: web.Application):
    transport: GameTransport = app['transport']
    service: GameService = app['service']
    simulator: SimulatorTransport = app['simulator']

    # Định nghĩa hàm vòng lặp vật lý
    async def ticker() -> None:
        interval = 1 / TICK_RATE
        loop = asyncio.get_running_loop()
        next_tick = loop.time()
        ticks = 0
        while True:
            next_tick += interval
            snapshots = service.advance()
            ticks += 1
            if ticks % (TICK_RATE // SNAPSHOT_RATE) == 0:
                await transport.publish(snapshots)
            await asyncio.sleep(max(0, next_tick - loop.time()))

    # Khởi chạy và dọn dẹp khi tắt Server
    task = asyncio.create_task(ticker())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    await simulator.close()
    await transport.close()

# 4. Hàm nhà máy (Factory function) khởi tạo và cấu hình ứng dụng
def create_app() -> web.Application:
    app = web.Application()
    # Khởi tạo 3 thành phần cốt lõi
    service = GameService()
    transport = GameTransport(service)
    simulator = SimulatorTransport(service)
    # Lưu trữ các đối tượng này vào app dictionary
    app['service'] = service
    transport.simulator = simulator
    app['transport'] = transport
    app['simulator'] = simulator
    # Đăng ký các tuyến đường HTTP/WebSocket:
    app.router.add_get('/health', health)
    transport.install_routes(app)
    simulator.install_routes(app)
    app.router.add_get('/', index)
    # Đăng ký thư mục tài nguyên tĩnh
    assets = FRONTEND_DIST / 'assets'
    if assets.is_dir():
        app.router.add_static('/assets', assets)
    samples = FRONTEND_DIST / 'samples'
    if samples.is_dir():
        app.router.add_static('/samples', samples)
    # Thêm hàm lifecycle vào app.cleanup_ctx để quản lý vòng đời simulation
    app.cleanup_ctx.append(lifecycle)
    return app

# Điểm đi vào của chương trình khi thực thi lệnh python -m app.main
if __name__ == '__main__':
    web.run_app(create_app(), host=os.environ.get('HOST', '0.0.0.0'), port=int(os.environ.get('PORT', '8000')))
