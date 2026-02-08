import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
          },
          '/healthz': {
            target: 'http://localhost:8000',
            changeOrigin: true,
            secure: false,
          },
        },
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
        // 压缩配置
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: mode === 'production', // 生产环境移除 console
            drop_debugger: true,
          },
        },
        // 资源大小警告阈值
        chunkSizeWarningLimit: 1000, // 1MB
      },
      // 优化依赖预构建
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom'],
      },
    };
});
