import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const { Catalog } = createRequire(import.meta.url)("../desktop/catalog.cjs");
test("catalog IDs survive display and actual file rename and source change", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/catalog-"));
  await fs.writeFile(
    path.join(root, "a.png"),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const c = new Catalog(root);
  const a = await c.scan();
  assert.equal(a.length, 1);
  await c.rename(a[0].id, "石纹");
  assert.equal((await c.scan())[0].id, a[0].id);
  await c.rename(a[0].id, "另一个名字", true);
  await fs.writeFile(
    path.join(root, "另一个名字.png"),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
  );
  const b = await new Catalog(root).scan();
  assert.equal(b[0].id, a[0].id);
  assert.notEqual(b[0].hash, a[0].hash);
  await assert.rejects(() => c.rename(a[0].id, "../escape", true));
});
