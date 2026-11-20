import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: path("./"),
  base: "/Nextstep/",
  publicDir: path("../public/"),
  plugins: [
    {
      name: "nextstep-pages-paths",
      enforce: "pre",
      transform(code, id) {
        if (!id.startsWith(path("../app/")) || !id.endsWith(".tsx")) return;
        if (["rich-content.tsx", "rich-editor.tsx", "mail-block.tsx"].some(name => id.endsWith("/" + name))) {
          code = 'import { mediaPath } from "@/github-pages/media";\n' + code
            .replace(/src=\{src\}|src=\{zoom.src\}|href=\{zoom.src\}|href=\{src\}/g,
              match => match.replace(/\{(.+)\}/, "{mediaPath($1)}"))
            .replace("HTMLAttributes.src:''", "mediaPath(HTMLAttributes.src):''");
        }
        return code
          .replace(/(["'])\/login(?=[?"'])/g, "$1/Nextstep/login/")
          .replace(/(href=|location\.assign\()(["'])\/\2/g, "$1$2/Nextstep/$2")
          .replace(/(["'])\/sw\.js\1/g, "$1/Nextstep/sw.js$1")
          .replace(/(getRegistration\(|scope:)(["'])\/\2/g, "$1$2/Nextstep/$2");
      },
    },
    react(),
  ],
  css: { postcss: path("../") },
  resolve: {
    alias: {
      "@": path("../"),
      "next/dynamic": path("./dynamic.tsx"),
      "iconv-lite": path("../lib/mail-encoding.ts"),
    },
  },
  build: { outDir: path("../dist/pages"), emptyOutDir: true },
});
