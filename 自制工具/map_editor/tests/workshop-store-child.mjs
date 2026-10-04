import { createRequire } from "node:module";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const { createWorkshopStore } = require("../desktop/workshop-store.cjs");
const root = process.argv[2],
  store = createWorkshopStore(root);
if (process.argv[3] === "recover") {
  await store.recover();
  process.exit(0);
}
const opened = await store.load("a.json");
// Fault injection is in the child test process, not in the product interface.
const rename = fs.rename;
let applied = 0;
fs.rename = async (...args) => {
  await rename(...args);
  if (/[\\/][ab]\.json$/.test(args[1])) if (++applied === 2) process.exit(23);
};
await store.commit([
  {
    path: "a.json",
    bytes: new TextEncoder().encode("new"),
    expectedHash: opened.hash,
  },
  {
    path: "b.json",
    bytes: new TextEncoder().encode("created"),
    expectedHash: null,
  },
  {
    path: "c.json",
    bytes: new TextEncoder().encode("not committed"),
    expectedHash: null,
  },
]);
throw Error("interruption point was not reached");
