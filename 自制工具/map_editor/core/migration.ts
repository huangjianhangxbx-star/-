import { validateMap } from "./document.ts";

/** v1 tags remain readable; this creates a separate normalized copy on request. */
export function inspectLegacyTags(input: any) {
  const doc = validateMap(input);
  const issues = doc.surfaces.filter((s: any) => s.face !== 4 &&
    ["walk", "deploy", "highground", "ground"].includes(s.tag))
    .map((s: any) => `非水平面 ${s.x},${s.y},${s.z}/${s.face} 标为 ${s.tag}`);
  const converted = doc.surfaces.filter((s: any) => s.face === 4 &&
    ["deploy", "ground"].includes(s.tag)).length;
  return { converted, issues };
}

export function migrateLegacyTags(input: any) {
  const doc = validateMap(input);
  const report = inspectLegacyTags(doc);
  if (report.issues.length) throw new Error(`旧标签存在待人工修正的侧面引用：${report.issues.slice(0, 3).join("；")}`);
  if (report.converted === 0) return { doc, report };
  if (doc.revision >= 2147483647) throw new Error("修订号已达上限，不能迁移");
  doc.surfaces = doc.surfaces.map((s: any) => s.face === 4 &&
    ["deploy", "ground"].includes(s.tag) ? { ...s, tag: "walk" } : s);
  doc.revision++;
  return { doc: validateMap(doc), report };
}
