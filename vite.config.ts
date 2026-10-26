import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "logo-light.png",
          "logo-dark.png",
          "apple-touch-icon.png",
        ],
        manifest: {
          name: "Entre Colunas",
          short_name: "Entre Colunas",
          description: "Gestão da loja, membros e finanças em um só lugar.",
          lang: "pt-BR",
          theme_color: "#011733",
          background_color: "#f8f7f2",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "/pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globIgnores: ["**/runtime-config.js"],
          globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: { port: 4173 },
  };
});
