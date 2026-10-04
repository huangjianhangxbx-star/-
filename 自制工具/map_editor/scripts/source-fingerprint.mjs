import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export async function sourceFingerprint(root) {
  const hash = createHash("sha256");
  async function visit(relative) {
    const entries = await fs.readdir(path.join(root, relative), {
      withFileTypes: true,
    });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(file);
      else if (/\.(ts|cjs|css|html|mjs|py)$/.test(entry.name)) {
        hash.update(file);
        hash.update(await fs.readFile(path.join(root, file)));
      }
    }
  }
  for (const dir of ["core", "desktop", "scripts"]) await visit(dir);
  return hash.digest("hex");
}
