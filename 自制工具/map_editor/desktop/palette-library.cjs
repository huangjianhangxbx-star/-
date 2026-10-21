const fs = require("node:fs/promises");
const path = require("node:path");
const DEFAULT = [
  "#202631",
  "#394655",
  "#59737a",
  "#91a9a3",
  "#dce3ca",
  "#e5d7b5",
  "#c7a46b",
  "#cc8d32",
  "#965c36",
  "#663a36",
  "#913d46",
  "#c97679",
  "#e3b9b7",
  "#513b64",
  "#876a99",
  "#b0a1c5",
  "#244e51",
  "#397b70",
  "#65b4ac",
  "#63c8d0",
  "#263a64",
  "#4267a5",
  "#7da8d9",
  "#d5e5f0",
  "#29382b",
  "#557a59",
  "#90ab68",
  "#d1ce75",
  "#261e29",
  "#51464b",
  "#817777",
  "#b9b0aa",
];
function parsePalette(text, format) {
  let colors;
  if (format === "json") {
    const value = JSON.parse(text);
    colors = Array.isArray(value) ? value : value.colors;
  } else if (format === "gpl") {
    if (!text.trimStart().startsWith("GIMP Palette"))
      throw Error("不是 GPL 色板");
    colors = text
      .split(/\r?\n/)
      .filter((l) => /^\s*\d/.test(l))
      .map((l) => {
        const rgb = l.trim().split(/\s+/).slice(0, 3).map(Number);
        if (
          rgb.length !== 3 ||
          rgb.some((v) => !Number.isInteger(v) || v < 0 || v > 255)
        )
          throw Error("无效 RGB");
        return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
      });
  } else throw Error("不支持的色板格式");
  if (
    !Array.isArray(colors) ||
    !colors.length ||
    colors.length > 256 ||
    colors.some((c) => typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c))
  )
    throw Error("色板需包含 1 至 256 个 #RRGGBB 颜色");
  return colors.map((c) => c.toLowerCase());
}
async function listPalettes(root, initialize = false) {
  if (initialize) {
    await fs.mkdir(root, { recursive: true });
    try {
      await fs.writeFile(
        path.join(root, "星骸基础32色.json"),
        JSON.stringify({ name: "星骸基础32色", colors: DEFAULT }, null, 2),
        { flag: "wx" },
      );
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  }
  const palettes = [],
    errors = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(json|gpl)$/i.test(entry.name)) continue;
    try {
      const file = path.join(root, entry.name);
      if ((await fs.stat(file)).size > 262144) throw Error("文件过大");
      palettes.push({
        name: entry.name,
        colors: parsePalette(
          await fs.readFile(file, "utf8"),
          path.extname(file).slice(1).toLowerCase(),
        ),
      });
    } catch (e) {
      errors.push(entry.name + ": " + e.message);
    }
  }
  palettes.sort((a, b) => a.name.localeCompare(b.name));
  return { root, palettes, errors };
}
module.exports = { parsePalette, listPalettes };
