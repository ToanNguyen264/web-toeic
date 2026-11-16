import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: Number(env.VITE_PORT || 5173),
    },
    preview: {
      host: true,
      port: 4173,
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)/,
                priority: 40,
              },
              {
                name: "query-vendor",
                test: /node_modules[\\/]@tanstack/,
                priority: 25,
              },
              {
                name: "icons-vendor",
                test: /node_modules[\\/]lucide-react/,
                priority: 20,
              },
              {
                name: "vendor",
                test: /node_modules/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
  };
});
