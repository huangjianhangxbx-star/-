type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}

/** Append one animation, or fill one explicitly selected empty placeholder, without editing the supplied target. */
export function appendDirectAnimation(
  targetDocument: unknown,
  animation: Record<string, unknown>,
  requestedName: string,
  options?: { emptyAnimation?: string },
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
  if (options?.emptyAnimation !== undefined) {
    if (requested !== options.emptyAnimation) throw new Error("新动画名称必须与所选空动画名称一致");
    const placeholder = animations[options.emptyAnimation];
    if (!Object.hasOwn(animations, options.emptyAnimation) || !placeholder || typeof placeholder !== "object" ||
        Object.getPrototypeOf(placeholder) !== Object.prototype || Reflect.ownKeys(placeholder).length !== 0) {
      throw new Error("所选目标必须是已存在且没有任何内容的空动画");
    }
    animations[requested] = structuredClone(animation);
    return { jsonText: JSON.stringify(target), name: requested };
  }
  let name = requested;
  for (let suffix = 2; Object.hasOwn(animations, name); suffix++) name = `${requested}_${suffix}`;
  animations[name] = structuredClone(animation);
  return { jsonText: JSON.stringify(target), name };
}
