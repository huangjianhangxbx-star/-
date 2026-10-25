import type { SpineChannelPolicy, SpineObjectMapping, SpineSide } from "../core/spine-contracts.ts";
import { readSpineSource } from "../source/spine-source.ts";
import { migrateSpineAnimation, type SpineMigrationReport } from "./spine-timelines.ts";

type JsonObject = Record<string, unknown>;
export type SpineMappingSuggestion = {
  kind: SpineObjectMapping["kind"];
  source: string;
  target?: string;
  status: "exact" | "ambiguous" | "missing";
  side: SpineSide;
  reason: string;
  sourceSkin?: string;
  sourceSlot?: string;
  warnings: readonly string[];
};

function objectAt(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function namesFor(document: JsonObject, kind: string): string[] {
  if (kind === "bone" || kind === "slot") {
    const entries = document[`${kind}s`];
    return Array.isArray(entries) ? entries.map((item) => objectAt(item).name).filter((name): name is string => typeof name === "string") : [];
  }
  if (kind === "event") return Object.keys(objectAt(document.events));
  const constraints = document.constraints;
  return Array.isArray(constraints) ? constraints.filter((item) => objectAt(item).type === kind)
    .map((item) => objectAt(item).name).filter((name): name is string => typeof name === "string") : [];
}

function sideOf(name: string): SpineSide {
  const tokens = name.split(/[\/:_.\-\s]+/).filter(Boolean);
  if (tokens.some((token, index) => /^(?:left|l)(?:arm|leg|hand|foot)\d*$/i.test(token) ||
    (/^(?:left|l)$/i.test(token) && /^(?:arm|leg|hand|foot)/i.test(tokens[index + 1] ?? "")))) return "left";
  if (tokens.some((token, index) => /^(?:right|r)(?:arm|leg|hand|foot)\d*$/i.test(token) ||
    (/^(?:right|r)$/i.test(token) && /^(?:arm|leg|hand|foot)/i.test(tokens[index + 1] ?? "")))) return "right";
  return "unknown";
}

function terminalName(name: string): string {
  return name.split(/[\/:_\-\s]+/).at(-1)?.toLowerCase() ?? name.toLowerCase();
}

/** Offer only exact typed names automatically; lookalikes stay ambiguous for human mapping. */
export function suggestSpineMappings(
  sourceDocument: unknown,
  targetDocument: unknown,
  animationName: string,
): SpineMappingSuggestion[] {
  const source = objectAt(sourceDocument);
  const target = objectAt(targetDocument);
  const dependencies = readSpineSource(JSON.stringify(source)).animationDependencies[animationName];
  if (!dependencies) throw new Error(`Source animation missing: ${animationName}`);
  const seen = new Set<string>();
  const suggestions: SpineMappingSuggestion[] = [];
  for (const dep of dependencies) {
    if (["unknown", "drawOrder", "attachment"].includes(dep.kind)) continue;
    const key = `${dep.kind}\0${dep.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const targets = namesFor(target, dep.kind);
    const exact = targets.filter((name) => name === dep.source);
    const lookalikes = targets.filter((name) => name.toLowerCase() === dep.source.toLowerCase() ||
      terminalName(name) === terminalName(dep.source));
    const status = exact.length === 1 ? "exact" : lookalikes.length > 0 ? "ambiguous" : "missing";
    const sourceSide = sideOf(dep.source);
    const warnings: string[] = [];
    if (status === "exact" && dep.kind === "bone") {
      const sourceBone = (source.bones as unknown[] | undefined)?.map(objectAt).find((bone) => bone.name === dep.source);
      const targetBone = (target.bones as unknown[] | undefined)?.map(objectAt).find((bone) => bone.name === dep.source);
      if (sourceBone && targetBone) {
        if (sourceBone.parent !== targetBone.parent) warnings.push("Parent chain differs; inspect local axes");
        if (Math.sign(Number(sourceBone.scaleX ?? 1) * Number(sourceBone.scaleY ?? 1)) !==
          Math.sign(Number(targetBone.scaleX ?? 1) * Number(targetBone.scaleY ?? 1))) warnings.push("Setup reflection differs");
      }
    }
    suggestions.push({ kind: dep.kind as SpineObjectMapping["kind"], source: dep.source,
      ...(status === "exact" ? { target: exact[0] } : {}), status, side: sourceSide,
      reason: status === "exact" ? "Unique exact name and object type" : status === "ambiguous"
        ? "Case or prefix lookalike; choose manually" : "No same-type exact name",
      warnings });
  }
  return suggestions;
}

/** The same compatibility gate used by migration, without emitting any output file. */
export function analyzeSpineMapping(
  sourceDocument: unknown,
  targetDocument: unknown,
  animationName: string,
  mappings: readonly SpineObjectMapping[],
  policies: readonly SpineChannelPolicy[] = [],
): SpineMigrationReport {
  return migrateSpineAnimation(sourceDocument, targetDocument, animationName, mappings, [], policies).report;
}
