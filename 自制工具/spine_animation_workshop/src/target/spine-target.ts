import type { TargetBone, TargetSummary } from "../core/contracts.ts";

type JsonObject = Record<string, unknown>;

export type AtlasResources = {
  atlasText: string;
  availablePageNames: readonly string[];
};

export type SpineDisplayInfo = {
  slots: readonly { name: string; bone: string; attachment: string | null }[];
  skins: readonly { name: string; slotCount: number; attachmentCount: number }[];
  /** Naming evidence only; a prefix does not prove a separately rigged direction. */
  candidateDirectionPrefixes: readonly { prefix: string; attachmentCount: number; visibleSetupSlots: number }[];
};

function objectAt(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function nameAt(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a nonempty string`);
  }
  return value;
}

function numberAt(value: unknown, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function stringArrayAt(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => nameAt(item, `${label}[${index}]`));
}

function validateAtlasPages(resources: AtlasResources): void {
  const lines = resources.atlasText.split(/\r?\n/).map((line) => line.trim());
  const pages = lines.filter((line, index) => line && /^size\s*:/i.test(lines[index + 1] ?? ""));
  if (pages.length === 0) throw new Error("Atlas has no image pages");
  const available = new Set(resources.availablePageNames.map((name) => name.replace(/\\/g, "/").split("/").at(-1)?.toLowerCase()));
  for (const page of pages) {
    if (!available.has(page.toLowerCase())) throw new Error(`Atlas page image missing: ${page}`);
  }
}

/** Read a complete Spine 4.3 export while exposing only the stable data needed by other modules. */
export function readSpineTarget(jsonText: string, resources?: AtlasResources): { summary: TargetSummary; document: unknown } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid Spine JSON: ${String(error)}`);
  }
  const document = objectAt(parsed, "Spine document");
  const skeleton = objectAt(document.skeleton, "skeleton");
  const editorVersion = nameAt(skeleton.spine, "skeleton.spine");
  if (!/^4\.3(?:\.|$)/.test(editorVersion)) {
    throw new Error(`Spine 4.3 export required; found ${editorVersion}`);
  }
  if (resources) validateAtlasPages(resources);

  if (!Array.isArray(document.bones) || document.bones.length === 0) {
    throw new Error("Spine target has no bones");
  }
  const bones: TargetBone[] = document.bones.map((item, index) => {
    const bone = objectAt(item, `bones[${index}]`);
    const name = nameAt(bone.name, `bones[${index}].name`);
    const parent = bone.parent === undefined ? null : nameAt(bone.parent, `bone ${name}.parent`);
    return {
      name,
      parent,
      x: numberAt(bone.x, 0, `bone ${name}.x`),
      y: numberAt(bone.y, 0, `bone ${name}.y`),
      rotation: numberAt(bone.rotation, 0, `bone ${name}.rotation`),
      scaleX: numberAt(bone.scaleX, 1, `bone ${name}.scaleX`),
      scaleY: numberAt(bone.scaleY, 1, `bone ${name}.scaleY`),
      length: numberAt(bone.length, 0, `bone ${name}.length`),
      ...(typeof bone.inherit === "string" ? { transform: bone.inherit } : {}),
    };
  });
  const boneNames = new Set<string>();
  for (const bone of bones) {
    if (boneNames.has(bone.name)) throw new Error(`Duplicate bone ${bone.name}`);
    boneNames.add(bone.name);
  }
  for (const bone of bones) {
    if (bone.parent !== null && !boneNames.has(bone.parent)) {
      throw new Error(`Bone ${bone.name} refers to missing parent ${bone.parent}`);
    }
  }

  const skins = document.skins === undefined ? [] : document.skins;
  if (!Array.isArray(skins)) throw new Error("skins must be an array");
  const skinNames = skins.map((item, index) => nameAt(objectAt(item, `skins[${index}]`).name, `skins[${index}].name`));

  const rawConstraints = document.constraints === undefined ? [] : document.constraints;
  if (!Array.isArray(rawConstraints)) throw new Error("constraints must be an array");
  const kinds = new Set(["ik", "transform", "path", "physics"]);
  const constraints = rawConstraints.map((item, index) => {
    const constraint = objectAt(item, `constraints[${index}]`);
    const kind = nameAt(constraint.type, `constraints[${index}].type`);
    if (!kinds.has(kind)) throw new Error(`Unsupported Spine constraint type ${kind}`);
    const name = nameAt(constraint.name, `constraints[${index}].name`);
    const targets = stringArrayAt(constraint.bones, `constraint ${name}.bones`);
    for (const target of targets) {
      if (!boneNames.has(target)) throw new Error(`Constraint ${name} refers to missing bone ${target}`);
    }
    const target = constraint.target === undefined ? null : nameAt(constraint.target, `constraint ${name}.target`);
    const source = constraint.source === undefined ? null : nameAt(constraint.source, `constraint ${name}.source`);
    return { kind: kind as TargetSummary["constraints"][number]["kind"], name, bones: targets, target, source };
  });

  const animations = document.animations === undefined ? {} : objectAt(document.animations, "animations");
  const summary: TargetSummary = {
    editorVersion,
    bones,
    skins: skinNames,
    animations: Object.keys(animations),
    constraints,
  };
  return { summary, document };
}

/** Inspect display dependencies without dropping or changing the complete export. */
export function extractDisplayInfo(document: unknown): SpineDisplayInfo {
  const source = objectAt(document, "Spine document");
  if (!Array.isArray(source.slots)) throw new Error("Spine document has no slots array");
  const slots = source.slots.map((item, index) => {
    const slot = objectAt(item, `slots[${index}]`);
    return {
      name: nameAt(slot.name, `slots[${index}].name`),
      bone: nameAt(slot.bone, `slots[${index}].bone`),
      attachment: slot.attachment === undefined || slot.attachment === null
        ? null : nameAt(slot.attachment, `slots[${index}].attachment`),
    };
  });
  if (!Array.isArray(source.skins)) throw new Error("Spine document has no skins array");
  const prefixCounts = new Map<string, number>();
  const skins = source.skins.map((item, index) => {
    const skin = objectAt(item, `skins[${index}]`);
    const attachments = skin.attachments === undefined ? {} : objectAt(skin.attachments, `skins[${index}].attachments`);
    let attachmentCount = 0;
    for (const [slotName, slotAttachments] of Object.entries(attachments)) {
      for (const attachmentName of Object.keys(objectAt(slotAttachments, `skin attachment slot ${slotName}`))) {
        attachmentCount++;
        const separator = attachmentName.indexOf("/");
        if (separator > 0) {
          const prefix = attachmentName.slice(0, separator);
          prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
        }
      }
    }
    return { name: nameAt(skin.name, `skins[${index}].name`), slotCount: Object.keys(attachments).length, attachmentCount };
  });
  const candidateDirectionPrefixes = [...prefixCounts].map(([prefix, attachmentCount]) => ({
    prefix,
    attachmentCount,
    visibleSetupSlots: slots.filter((slot) => slot.attachment?.startsWith(`${prefix}/`)).length,
  })).sort((a, b) => b.attachmentCount - a.attachmentCount || a.prefix.localeCompare(b.prefix));
  return { slots, skins, candidateDirectionPrefixes };
}
