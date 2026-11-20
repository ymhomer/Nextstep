import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const target = new URL("lib/pdf-data/", root);
const packageRoot = new URL("node_modules/pdfjs-dist/", root);
const { version } = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));

await mkdir(target, { recursive: true });
for (const [folder, pattern] of [["cmaps", /\.bcmap$/], ["standard_fonts", /\.(ttf|pfb)$/]]) {
  const source = new URL(folder + "/", packageRoot);
  const names = (await readdir(source)).filter(name => pattern.test(name)).sort();
  const entries = await Promise.all(names.map(async name => [
    name, (await readFile(new URL(name, source))).toString("base64"),
  ]));
  await writeFile(new URL(folder + ".ts", target),
    `// Generated from pdfjs-dist ${version}; Apache-2.0. See public/licenses/pdfjs-dist-LICENSE.\nexport const data:Record<string,string>=${JSON.stringify(Object.fromEntries(entries))};\n`);
}
