// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// O frontend encaminha /api para a API local. A porta da API vem de API_PORT
// (default 3001 em dev local; no servidor usamos uma porta interna, ex.: 3051).
const apiTarget = `http://localhost:${process.env.API_PORT || 3001}`;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Libera o acesso por qualquer nome de host (ex.: http://intrahsj:3050).
      // O Vite, por padrão, bloqueia Hosts desconhecidos ("Blocked request...").
      // Como é um serviço interno acessado por toda a empresa via DNS da infra,
      // aceitamos qualquer Host. Para restringir, troque por uma lista, ex.:
      //   allowedHosts: ["intrahsj", "10.10.0.56", "localhost"]
      allowedHosts: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      allowedHosts: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
  },
});
