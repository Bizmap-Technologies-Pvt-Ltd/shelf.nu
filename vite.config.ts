import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { devServer } from "react-router-hono-server/dev";
import esbuild from "esbuild";
import { flatRoutes } from "remix-flat-routes";
import { cjsInterop } from "vite-plugin-cjs-interop";
import { init } from "@paralleldrive/cuid2";
import fs from "node:fs";

const createHash = init({
  length: 8,
});

const buildHash = process.env.BUILD_HASH || createHash();

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    warmup: {
      clientFiles: [
        "./app/entry.client.tsx",
        "./app/root.tsx",
        "./app/routes/**/*",
        "./app/components/**/*",
      ],
    },
    middlewareMode: false,
    preTransformRequests: true,
    hmr: {
      overlay: false, // Disable overlay for faster dev
    },
    fs: {
      allow: ['..']
    }
  },
  optimizeDeps: {
    include: [
      "./app/routes/**/*",
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@remix-run/react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select", 
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-dialog",
      "@radix-ui/react-checkbox",
      "lucide-react",
      "date-fns",
      "lodash",
      "@prisma/client",
      "zod",
      "lru-cache"
    ],
    force: false, // Let Vite decide when to re-optimize
    esbuildOptions: {
      target: 'es2022',
      loader: { '.js': 'jsx' }
    }
  },
  esbuild: {
    target: "es2022",
    keepNames: true,
    minifyIdentifiers: false,
  },
  build: {
    target: "ES2022",
    assetsDir: `file-assets`,
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: `file-assets/${buildHash}/[name]-[hash].js`,
        chunkFileNames() {
          return `file-assets/${buildHash}/[name]-[hash].js`;
        },
        assetFileNames() {
          return `file-assets/${buildHash}/[name][extname]`;
        },
        manualChunks: {
          // Remove all manual chunks to fix SSR build - external modules cannot be included in manualChunks
          // vendor: ['react', 'react-dom'], // Remove react from manual chunks to fix SSR build
          // remix: ['@remix-run/react'], // Remove remix from manual chunks to fix SSR build
          // ui: ['@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-dialog'], // Remove UI libraries from manual chunks to fix SSR build
          // icons: ['lucide-react'], // Remove icons from manual chunks to fix SSR build
          // utils: ['date-fns', 'lodash', 'zod'], // Remove utils from manual chunks to fix SSR build
          // cache: ['lru-cache'] // Remove cache from manual chunks to fix SSR build
        }
      },
      treeshake: {
        moduleSideEffects: false
      }
    },
  },
  resolve: {
    alias: {
      ".prisma/client/index-browser":
        "./node_modules/.prisma/client/index-browser.js",
    },
  },
  plugins: [
    cjsInterop({
      // List of CJS dependencies that require interop
      dependencies: [
        "react-microsoft-clarity",
        "@markdoc/markdoc",
        "react-to-print",
      ],
    }),
    devServer(),

    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        unstable_optimizeDeps: true,
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
      routes: async (defineRoutes) => {
        return flatRoutes("routes", defineRoutes);
      },

      buildEnd: async ({ remixConfig }) => {
        const sentryInstrument = `instrument.server`;
        await esbuild
          .build({
            alias: {
              "~": `./app`,
            },
            outdir: `${remixConfig.buildDirectory}/server`,
            entryPoints: [`./server/${sentryInstrument}.ts`],
            platform: "node",
            format: "esm",
            // Don't include node_modules in the bundle
            packages: "external",
            bundle: true,
            logLevel: "info",
          })
          .then(() => {
            const serverBuildPath = `${remixConfig.buildDirectory}/server/${remixConfig.serverBuildFile}`;
            fs.writeFileSync(
              serverBuildPath,
              Buffer.concat([
                Buffer.from(`import "./${sentryInstrument}.js"\n`),
                Buffer.from(fs.readFileSync(serverBuildPath)),
              ])
            );
          })
          .catch((error: unknown) => {
            console.error(error);
            process.exit(1);
          });
      },
    }),
    tsconfigPaths(),
  ],
});
