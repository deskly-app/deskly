import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import generouted from '@generouted/react-router/plugin'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

// @ts-expect-error process is a Node.js global
const host = process.env.TAURI_DEV_HOST;
const isMobile = process.env.TAURI_ENV_PLATFORM === "android" || process.env.TAURI_ENV_PLATFORM === "ios";

// Synchronously sync pages folder before Vite starts
function syncPagesDirectory(isMobile: boolean) {
  const source = isMobile ? "src/pages-mobile" : "src/pages-desktop";
  const target = "src/pages";

  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(source, target, { recursive: true });
    fs.writeFileSync(
      path.join(target, "README.md"),
      `# DO NOT EDIT THIS DIRECTORY\n\nThis folder is dynamically generated and overwritten at compile-time by \`vite.config.ts\` depending on the build target.\n\n- To edit desktop pages: edit files inside \`src/pages-desktop/\`\n- To edit mobile pages: edit files inside \`src/pages-mobile/\`\n\nAny changes made directly in \`src/pages/\` will be lost.\n`
    );
    console.log(`[Platform Sync] Copied ${source} to ${target}`);
  } catch (err) {
    console.error("Failed to sync pages directory:", err);
  }
}

syncPagesDirectory(isMobile);

// Vite plugin to mirror watch edits from source directory to generated pages for HMR support
function platformSyncPlugin(): import("vite").Plugin {
  return {
    name: "platform-sync-plugin",
    handleHotUpdate({ file, server }) {
      const sourceDir = isMobile ? "src/pages-mobile" : "src/pages-desktop";
      const relativePath = path.relative(path.resolve(sourceDir), file);

      // If the changed file is inside our active source directory
      if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
        const destPath = path.join("src/pages", relativePath);
        try {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(file, destPath);
          console.log(`[Platform Sync] Synced watch edit to ${destPath}`);

          // Reload Vite module graph for the destination file
          const moduleNode = server.moduleGraph.getModuleById(path.resolve(destPath));
          if (moduleNode) {
            server.reloadModule(moduleNode);
          }
        } catch (err) {
          console.error("[Platform Sync] Failed to sync watch edit:", err);
        }
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    generouted(),
    tailwindcss(),
    platformSyncPlugin(),
  ],
  define: {
    __IS_MOBILE__: JSON.stringify(isMobile),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
              return "vendor-charts";
            }
            if (id.includes("lucide-react") || id.includes("@phosphor-icons")) {
              return "vendor-icons";
            }
            if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
              return "vendor-motion";
            }
            if (id.includes("date-fns") || id.includes("react-day-picker")) {
              return "vendor-date";
            }
            if (id.includes("@radix-ui") || id.includes("@base-ui")) {
              return "vendor-ui";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
              return "vendor-react";
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
