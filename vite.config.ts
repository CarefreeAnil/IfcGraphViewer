import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  /*server: {
    host: "::",
    port: 8080,
    allowedHosts: ["ifcgraphviewer.onrender.com"],
  },*/
  plugins: [
    react(),
    //mode === "development" && componentTagger(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/web-ifc/*.wasm",
          dest: "",
        },
      ],
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["web-ifc"],
    // Pre-bundle the navmesh worker's deps so their first use doesn't trigger
    // a dev-server "new dependency optimized" full reload (which would unload
    // the model mid-session). No effect on the production build.
    include: ["recast-navigation", "recast-navigation/generators"],
  },
  // ES-module workers so module workers that pull code-split deps (the navmesh
  // worker imports recast-navigation, which dynamic-imports its wasm) build.
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries (changes rarely, cache for months)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // 3D rendering library (large, changes rarely)
          'vendor-three': ['three'],

          // IFC parsing library (largest dependency, changes rarely)
          'vendor-ifc': ['web-ifc'],

          // Graph visualization libraries (moderate size, changes rarely)
          'vendor-graph': ['react-force-graph-2d'],

          // UI component library (many small components, changes rarely)
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-select', '@radix-ui/react-tabs',
                        '@radix-ui/react-tooltip', '@radix-ui/react-checkbox',
                        '@radix-ui/react-label', '@radix-ui/react-slot',
                        '@radix-ui/react-toast', '@radix-ui/react-separator'],

          // Animation libraries (moderate size, changes rarely)
          'vendor-animation': ['framer-motion'],

          // Utility libraries (small, changes rarely)
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
  },
}));
