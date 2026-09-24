import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Calculate dynamic build version from environment variables (GitHub CI/CD, Vercel, or package version)
  const baseVersion = env.VITE_APP_VERSION || process.env.VITE_APP_VERSION || process.env.npm_package_version || '26.0.0';
  const gitSha = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '';
  const runNumber = process.env.GITHUB_RUN_NUMBER;
  
  let dynamicVersion = baseVersion;
  if (runNumber) {
    // If running in GitHub Actions CI/CD deployment
    dynamicVersion = `26.0.${runNumber}`;
  } else if (gitSha) {
    dynamicVersion = `${baseVersion} (${gitSha.slice(0, 7)})`;
  }

  const buildTime = new Date().toISOString();

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Parallel Text',
          short_name: 'ParallelText',
          description: 'A tool for text processing',
          theme_color: '#0f172a',
          icons: []
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          maximumFileSizeToCacheInBytes: 6000000,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(dynamicVersion),
      '__BUILD_TIME__': JSON.stringify(buildTime),
      '__GIT_COMMIT__': JSON.stringify(gitSha),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
