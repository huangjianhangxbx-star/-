type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

/** Append one native Spine animation under a unique name; never edit the supplied target. */
export function appendDirectAnimation(
  targetDocument: unknown,
  animation: Record<string, unknown>,
  requestedName: string,
): { jsonText: string; name: string } {
  const requested = requestedName.trim();
  if (!requested) throw new Error("Animation output name cannot be empty");
  objectAt(animation, "animation");
  const target = structuredClone(objectAt(targetDocument, "target document"));
  const skeleton = objectAt(target.skeleton, "target skeleton");
  if (typeof skeleton.spine !== "string" || !/^4\.3(?:\.|$)/.test(skeleton.spine)) {
    throw new Error("Spine 4.3 target required");
  }
  const animations = target.animations === undefined ? {} : objectAt(target.animations, "target animations");
  target.animations = animations;
  let name = requested;
  for (let suffix = 2; Object.hasOwn(animations, name); suffix++) name = `${requested}_${suffix}`;
  animations[name] = structuredClone(animation);
  return { jsonText: JSON.stringify(target), name };
}
