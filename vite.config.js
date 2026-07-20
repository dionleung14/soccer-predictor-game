import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  server: {
    open: true,
    port: 3000,
    proxy: {
      // Forward requests starting with /v4 to the remote API to avoid CORS in development
      '/v4': {
        target: 'https://api.football-data.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/v4/, '/v4'),
      },
    },
  },
  plugins: [react()],
});
