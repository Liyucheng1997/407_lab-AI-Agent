import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径：打包后的 dist 可以放在任意目录下托管
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
