import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0',  // lắng nghe trên tất cả các giao diện mạng (network interfaces) đang tồn tại trên máy tính
    proxy: {
      '/ws': { target: 'http://127.0.0.1:8000', ws: true },
      '/sim/ws': { target: 'http://127.0.0.1:8000', ws: true },
      '/health': 'http://127.0.0.1:8000'
    }
  }
});
