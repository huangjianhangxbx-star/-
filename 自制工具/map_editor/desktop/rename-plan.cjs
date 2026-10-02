const path = require("node:path");

function validName(name) {
  return typeof name === "string" && name.length >= 1 && name.length <= 120 &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !/[. ]$/.test(name) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) &&
    name !== "." && name !== "..";
}
const norm = (s) => s.replaceAll("\\", "/").toLocaleLowerCase("en-US");
function buildRenamePlan(rows, ids, options = {}, physical = false) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 300 || new Set(ids).size !== ids.length)
    throw Error("请选择1至300件不重复的资产");
  const sep = options.separator ?? "_";
  if (typeof sep !== "string" || sep.length > 2 || /[<>:"/\\|?*\x00-\x1f. ]/.test(sep))
    throw Error("分隔符无效");
  const width = options.numberWidth ?? 3, start = options.numberStart ?? 1;
  if (!Number.isInteger(width) || width < 0 || width > 8 || !Number.isSafeInteger(start) || start < 0 || start > 99999999)
    throw Error("编号参数无效");
  const fields = ["prefix", "kit", "category", "subject", "variant", "suffix"];
  for (const key of fields)
    if (options[key] != null && (typeof options[key] !== "string" || options[key].length > 80 ||
      /[<>:"/\\|?*\x00-\x1f]/.test(options[key]))) throw Error(`${key} 字段有非法字符`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = ids.map((id, index) => {
    const row = byId.get(id);
    if (!row || !["glb", "png"].includes(row.type)) throw Error(`资产 ${id} 不可作为命名主体`);
    const parts = fields.map((key) => key === "subject" ? (options.subject || row.name) : options[key])
      .filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
    if (width) parts.push(String(start + index).padStart(width, "0"));
    const newName = parts.join(sep);
    if (!validName(newName)) throw Error(`Windows 保留名称或无效文件名：${newName}`);
    const related = [row.path];
    if (physical) for (const linked of [row.source, row.exchange]) if (linked) related.push(linked);
    const moves = physical ? related.map((from) => {
      const to = path.posix.join(path.posix.dirname(from), `${newName}${path.posix.extname(from)}`);
      if (to.length > 240 || to.split("/").some((piece) => !validName(piece)))
        throw Error(`目标路径过长或非法：${to}`);
      return { from, to };
    }) : [];
    return { id, oldName: row.name, newName, moves };
  });
  const targets = new Map(), sources = new Set(items.flatMap((i) => i.moves.map((m) => norm(m.from))));
  const occupied = new Set(rows.map((r) => norm(r.path)));
  for (const item of items) {
    const nameKey = norm(item.newName);
    if (!physical && items.filter((p) => norm(p.newName) === nameKey).length > 1)
      throw Error(`批内显示名重复：${item.newName}`);
    for (const move of item.moves) {
      const to = norm(move.to), from = norm(move.from);
      if (targets.has(to) && targets.get(to) !== from) throw Error(`批内目标重复：${move.to}`);
      targets.set(to, from);
      if (occupied.has(to) && !sources.has(to) && to !== from) throw Error(`目标文件已存在：${move.to}`);
    }
  }
  return { physical, items, fileCount: items.reduce((n, i) => n + i.moves.length, 0) };
}
module.exports = { buildRenamePlan, validName };
