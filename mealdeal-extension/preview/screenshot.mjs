import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "../preview-dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".map": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = join(ROOT, urlPath);
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error("not a file");
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(4173, r));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1800, height: 980 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto("http://localhost:4173/index.html", { waitUntil: "load" });
// wait for React trees to mount
await page.waitForSelector("#frame-detected .detected-cart");
await page.waitForSelector("#frame-detected-no-address .detected-cart");
await page.waitForSelector("#frame-running .loading-state");
await page.waitForSelector("#frame-result .result-card");
await page.waitForTimeout(250);

const outDir = resolve(__dirname, "../preview-dist");
await page.screenshot({
  path: join(outDir, "preview-all.png"),
  fullPage: true,
});

for (const [id, name] of [
  ["frame-detected", "detected"],
  ["frame-detected-no-address", "detected-no-address"],
  ["frame-running", "running"],
  ["frame-result", "result"],
]) {
  const handle = await page.$(`#${id}`);
  if (handle) {
    await handle.screenshot({ path: join(outDir, `preview-${name}.png`) });
  }
}

await browser.close();
server.close();
console.log("Screenshots written to preview-dist/");
