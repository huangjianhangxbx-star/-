import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tests/fixtures');
await fs.mkdir(directory, { recursive: true });
for (const [name, style] of [['content-01.png', false], ['style-01.png', true]]) {
  const image = new pngjs.PNG({ width: 32, height: 24 });
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    const offset = (y * 32 + x) * 4;
    const edge = x % 16 === 0 || y % 8 === 0;
    const color = style ? (x < 16 ? [104, 91, 76] : [171, 146, 106]) : (edge ? [38, 43, 47] : [124, 132, 129]);
    image.data.set([...color, 255], offset);
  }
  await fs.writeFile(path.join(directory, name), pngjs.PNG.sync.write(image));
}
