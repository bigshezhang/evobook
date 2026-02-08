import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // 后端地址：优先读环境变量，脚本可通过 BACKEND_URL 覆盖
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const proxyConfig = {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
      '/healthz': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
    };
    return {
      // 开发服务器配置
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['evobook.arunningstar.com'],
        proxy: proxyConfig,
      },
      // 生产预览服务器配置（vite preview）
      preview: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['evobook.arunningstar.com'],
        proxy: proxyConfig,
      },
      // 生产环境移除 console 和 debugger
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 代码分割优化
        rollupOptions: {
          output: {
            manualChunks: {
              // 将 React 相关库单独打包
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              // 将工具库单独打包
              'utils': ['./utils/api', './utils/mascotUtils', './utils/mascotConfig'],
            },
            // 资源文件命名
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name.split('.');
              const ext = info[info.length - 1];
              if (/\.(mp4|webm|mov|ogg)$/i.test(assetInfo.name)) {
                return `assets/video/[name]-[hash][extname]`;
              }
              if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
                return `assets/images/[name]-[hash][extname]`;
              }
              return `assets/[name]-[hash][extname]`;
            },
          },
        },
        // 资源内联阈值（小于此大小的资源会被内联为 base64）
        assetsInlineLimit: 4096, // 4KB
        // 启用 CSS 代码分割
        cssCodeSplit: true,
        // 压缩配置（使用内置 esbuild，比 terser 快 20-40 倍）
        minify: 'esbuild',
        // 资源大小警告阈值
        chunkSizeWarningLimit: 1000, // 1MB
      },
      // 优化依赖预构建
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom'],
      },
    };
});
