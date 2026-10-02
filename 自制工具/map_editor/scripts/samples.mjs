import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  PNG,
} = require("C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs");
const png = new PNG({ width: 64, height: 64 });
for (let y = 0; y < 64; y++)
  for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4,
      on = Math.abs(x - 32) < 5 || Math.abs(y - 32) < 5;
    png.data[i] = 190;
    png.data[i + 1] = 145;
    png.data[i + 2] = 60;
    png.data[i + 3] = on ? 210 : 0;
  }
await fs.writeFile("fixtures/纹样.png", PNG.sync.write(png));
