import type {
  DriverFrame,
  DriverMapping,
  JointPose,
  MotionSource,
  TargetBone,
  TargetSummary,
  TransferConfig,
} from "../core/contracts.ts";

type Vec2 = readonly [number, number];
type Vec3 = readonly [number, number, number];
type Affine2 = readonly [number, number, number, number, number, number];
type Key = DriverFrame["keys"][number];
type Diagnostic = DriverFrame["diagnostics"][number];

const EPSILON = 1e-8;
const RADIANS = Math.PI / 180;

function add3(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract3(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function multiply3(a: Vec3, value: number): Vec3 { return [a[0] * value, a[1] * value, a[2] * value]; }
function dot3(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function length2(v: Vec2): number { return Math.hypot(v[0], v[1]); }
function angle2(v: Vec2): number { return Math.atan2(v[1], v[0]) / RADIANS; }
function wrapDegrees(value: number): number {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function axis(value: string, label: string): Vec3 {
  const match = /^([+-])([XYZ])$/i.exec(value);
  if (!match) throw new Error(`${label} must be +X, -X, +Y, -Y, +Z, or -Z`);
  const sign = match[1] === "-" ? -1 : 1;
  switch (match[2]?.toUpperCase()) {
    case "X": return [sign, 0, 0];
    case "Y": return [0, sign, 0];
    default: return [0, 0, sign];
  }
}

function matrixPosition(matrix: readonly number[], label: string): Vec3 {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label} needs a finite 16-value column-major matrix`);
  }
  return [matrix[12]!, matrix[13]!, matrix[14]!];
}

function localMatrix(bone: TargetBone, delta: Partial<Record<Key["property"], number>> = {}): Affine2 {
  const rotation = (bone.rotation + (delta.rotation ?? 0)) * RADIANS;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const scaleX = bone.scaleX * (delta.scaleX ?? 1);
  const scaleY = bone.scaleY * (delta.scaleY ?? 1);
  return [
    cosine * scaleX, sine * scaleX,
    -sine * scaleY, cosine * scaleY,
    bone.x + (delta.x ?? 0), bone.y + (delta.y ?? 0),
  ];
}

function multiply2(parent: Affine2, child: Affine2): Affine2 {
  const [a, b, c, d, tx, ty] = parent;
  const [e, f, g, h, ux, uy] = child;
  return [a * e + c * f, b * e + d * f, a * g + c * h, b * g + d * h, a * ux + c * uy + tx, b * ux + d * uy + ty];
}

function inverseLinear(matrix: Affine2, vector: Vec2, label: string): Vec2 {
  const [a, b, c, d] = matrix;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < EPSILON) throw new Error(`Cannot invert target parent transform for ${label}`);
  return [(d * vector[0] - c * vector[1]) / determinant, (-b * vector[0] + a * vector[1]) / determinant];
}

function inversePoint(matrix: Affine2, point: Vec2, label: string): Vec2 {
  return inverseLinear(matrix, [point[0] - matrix[4], point[1] - matrix[5]], label);
}

function mapPose(pose: readonly JointPose[]): Map<string, JointPose> {
  const result = new Map<string, JointPose>();
  for (const joint of pose) {
    if (result.has(joint.path)) throw new Error(`Duplicate source joint path ${joint.path}`);
    matrixPosition(joint.world, `${joint.path}.world`);
    matrixPosition(joint.bindWorld, `${joint.path}.bindWorld`);
    result.set(joint.path, joint);
  }
  return result;
}

function mappedPosition(pose: ReadonlyMap<string, JointPose>, path: string, useBind: boolean): Vec3 {
  const joint = pose.get(path);
  if (!joint) throw new Error(`Missing source joint ${path}`);
  return matrixPosition(useBind ? joint.bindWorld : joint.world, path);
}

function sourceEnd(mapping: DriverMapping, source: MotionSource): string {
  if (mapping.sourceEndPath) {
    if (!source.joints.some((joint) => joint.path === mapping.sourceEndPath)) {
      throw new Error(`Missing source segment endpoint ${mapping.sourceEndPath} for ${mapping.target}`);
    }
    return mapping.sourceEndPath;
  }
  const children = source.joints.filter((joint) => joint.parentPath === mapping.sourcePath);
  if (children.length !== 1) {
    throw new Error(`Source joint ${mapping.sourcePath} has ${children.length} direct children; set sourceEndPath for ${mapping.target}`);
  }
  return children[0]!.path;
}

function ancestorDepth(name: string, bones: ReadonlyMap<string, TargetBone>, visiting = new Set<string>()): number {
  const bone = bones.get(name);
  if (!bone) throw new Error(`Missing target bone ${name}`);
  if (visiting.has(name)) throw new Error(`Cycle in target bone hierarchy at ${name}`);
  if (!bone.parent) return 0;
  visiting.add(name);
  const depth = 1 + ancestorDepth(bone.parent, bones, visiting);
  visiting.delete(name);
  return depth;
}

/** Create a deterministic single-frame transfer. All output keys are Spine timeline deltas from setup pose. */
export function createTransfer(
  source: MotionSource,
  target: TargetSummary,
  config: TransferConfig,
): { poseAt(sourceSeconds: number): DriverFrame } {
  const clip = source.clips.find((candidate) => candidate.id === config.source.clipId);
  if (!clip) throw new Error(`Missing source clip ${config.source.clipId}`);
  const [rangeStart, rangeEnd] = config.source.rangeSeconds;
  if (![rangeStart, rangeEnd, config.sampleHz].every(Number.isFinite) || rangeStart < 0 || rangeEnd <= rangeStart || rangeEnd > clip.durationSeconds + EPSILON) {
    throw new Error(`Invalid source time range ${rangeStart}–${rangeEnd} for clip ${clip.name}`);
  }
  if (config.source.referenceSeconds !== undefined && (!Number.isFinite(config.source.referenceSeconds) || config.source.referenceSeconds < 0 || config.source.referenceSeconds > clip.durationSeconds)) {
    throw new Error(`Invalid reference time ${config.source.referenceSeconds}`);
  }
  if (config.sampleHz <= 0 || !Number.isFinite(config.anchors.scale) || config.anchors.scale <= 0) {
    throw new Error("Sample rate and projection scale must be positive and finite");
  }
  if (![config.view.yawDegrees, config.view.pitchDegrees, config.anchors.offsetX, config.anchors.offsetY].every(Number.isFinite) || Math.abs(config.view.pitchDegrees) >= 90) {
    throw new Error("View and alignment values must be finite; pitch must stay below 90 degrees");
  }
  if (config.rootPolicy !== "in-place-ground") throw new Error(`Unsupported root policy ${config.rootPolicy}`);

  const up = axis(config.source.upAxis, "upAxis");
  const front = axis(config.source.frontAxis, "frontAxis");
  if (Math.abs(dot3(up, front)) > EPSILON) throw new Error("Source frontAxis and upAxis must be perpendicular");
  const yaw = config.view.yawDegrees * RADIANS;
  const pitch = config.view.pitchDegrees * RADIANS;
  const horizontal = add3(multiply3(front, Math.cos(yaw)), multiply3(cross3(up, front), Math.sin(yaw)));
  const screenRight = cross3(up, horizontal);
  const screenUp = subtract3(multiply3(up, Math.cos(pitch)), multiply3(horizontal, Math.sin(pitch)));
  const project = (vector: Vec3): Vec2 => [dot3(vector, screenRight) * (config.view.mirror ? -1 : 1), dot3(vector, screenUp)];

  const sourcePaths = new Set(source.joints.map((joint) => joint.path));
  if (sourcePaths.size !== source.joints.length) throw new Error("Duplicate source joint paths");
  if (!sourcePaths.has(config.anchors.sourceFootPath)) throw new Error(`Missing source foot anchor ${config.anchors.sourceFootPath}`);
  let rootPath = config.anchors.sourceRootPath ?? config.anchors.sourceFootPath;
  if (!config.anchors.sourceRootPath) {
    const byPath = new Map(source.joints.map((joint) => [joint.path, joint]));
    while (byPath.get(rootPath)?.parentPath) rootPath = byPath.get(rootPath)!.parentPath!;
  }
  if (!sourcePaths.has(rootPath)) throw new Error(`Missing source motion root ${rootPath}`);

  const bones = new Map(target.bones.map((bone) => [bone.name, bone]));
  if (bones.size !== target.bones.length) throw new Error("Duplicate target bone names");
  if (!bones.has(config.anchors.targetFootBone)) throw new Error(`Missing target foot anchor ${config.anchors.targetFootBone}`);
  const depth = new Map(target.bones.map((bone) => [bone.name, ancestorDepth(bone.name, bones)]));
  const corrections = new Map(config.chainCorrections.map((correction) => [correction.target, correction]));
  for (const correction of config.chainCorrections) {
    if (!bones.has(correction.target)) throw new Error(`Missing correction target ${correction.target}`);
    if (![correction.rotationDegrees, correction.offsetX, correction.offsetY].filter((value) => value !== undefined).every(Number.isFinite)) {
      throw new Error(`Correction values for ${correction.target} must be finite`);
    }
  }

  const activeMappings = config.mappings.filter((mapping) => mapping.mode !== "skip");
  if (activeMappings.length === 0) throw new Error("At least one source-to-target mapping is required");
  const mappedTargets = new Set<string>();
  for (const mapping of activeMappings) {
    if (!sourcePaths.has(mapping.sourcePath)) throw new Error(`Missing source joint ${mapping.sourcePath}`);
    if (!bones.has(mapping.target)) throw new Error(`Missing target bone ${mapping.target}`);
    if (mappedTargets.has(mapping.target)) throw new Error(`Duplicate target mapping ${mapping.target}`);
    mappedTargets.add(mapping.target);
    if (mapping.mode === "fk-bone") {
      const controlling = target.constraints.find((constraint) => (constraint.kind === "ik" || constraint.kind === "transform") && constraint.bones.includes(mapping.target));
      if (controlling) throw new Error(`Target ${mapping.target} is controlled by ${controlling.kind} constraint ${controlling.name}; map its controller instead`);
      sourceEnd(mapping, source);
    }
    if (mapping.mode === "ik-target" && !target.constraints.some((constraint) => constraint.kind === "ik" && constraint.target === mapping.target)) {
      throw new Error(`Target ${mapping.target} is not an IK target`);
    }
    if (mapping.mode === "transform-control" && mapping.sourceEndPath) sourceEnd(mapping, source);
  }
  const ordered = [...activeMappings].sort((a, b) => (depth.get(a.target)! - depth.get(b.target)!) || a.target.localeCompare(b.target));

  const referenceTime = config.source.referenceSeconds;
  const referencePose = mapPose(source.poseAt(config.source.clipId, referenceTime ?? rangeStart));
  const referencePosition = (path: string): Vec3 => mappedPosition(referencePose, path, referenceTime === undefined);

  function worldMatrix(name: string, keyValues: ReadonlyMap<string, Partial<Record<Key["property"], number>>>, stack = new Set<string>()): Affine2 {
    const bone = bones.get(name);
    if (!bone) throw new Error(`Missing target bone ${name}`);
    if (stack.has(name)) throw new Error(`Cycle in target bone hierarchy at ${name}`);
    if (bone.transform && bone.transform !== "normal") {
      throw new Error(`Target bone ${name} uses unsupported inherit mode ${bone.transform}`);
    }
    stack.add(name);
    const local = localMatrix(bone, keyValues.get(name));
    const result = bone.parent ? multiply2(worldMatrix(bone.parent, keyValues, stack), local) : local;
    stack.delete(name);
    return result;
  }
  const emptyKeys = new Map<string, Partial<Record<Key["property"], number>>>();
  // The full Spine document may contain unrelated noScale/noRotation branches.
  // Only solve the selected drivers and their anchor; worldMatrix still checks
  // every ancestor on each selected chain instead of silently approximating it.
  const setupNames = new Set([config.anchors.targetFootBone, ...ordered.map((mapping) => mapping.target)]);
  const setupWorld = new Map([...setupNames].map((name) => [name, worldMatrix(name, emptyKeys)]));

  return {
    poseAt(sourceSeconds): DriverFrame {
      if (!Number.isFinite(sourceSeconds) || sourceSeconds < rangeStart - EPSILON || sourceSeconds > rangeEnd + EPSILON) {
        throw new Error(`Source time ${sourceSeconds} is outside selected range ${rangeStart}–${rangeEnd}`);
      }
      const current = mapPose(source.poseAt(config.source.clipId, sourceSeconds));
      const rootTravel = subtract3(mappedPosition(current, rootPath, false), referencePosition(rootPath));
      const groundTravel = subtract3(rootTravel, multiply3(up, dot3(rootTravel, up)));
      const keys: Key[] = [];
      const diagnostics: Diagnostic[] = [];
      const keyValues = new Map<string, Partial<Record<Key["property"], number>>>();

      for (const mapping of ordered) {
        const targetBone = bones.get(mapping.target)!;
        const correction = corrections.get(mapping.target);
        const values: Partial<Record<Key["property"], number>> = {};
        const parentWorld = targetBone.parent ? worldMatrix(targetBone.parent, keyValues) : [1, 0, 0, 1, 0, 0] as const;

        if (mapping.mode === "ik-target" || mapping.mode === "transform-control") {
          const displacement = subtract3(subtract3(mappedPosition(current, mapping.sourcePath, false), referencePosition(mapping.sourcePath)), groundTravel);
          const projected = project(displacement);
          const setup = setupWorld.get(mapping.target)!;
          const desired: Vec2 = [
            setup[4] + projected[0] * config.anchors.scale + config.anchors.offsetX + (correction?.offsetX ?? 0),
            setup[5] + projected[1] * config.anchors.scale + config.anchors.offsetY + (correction?.offsetY ?? 0),
          ];
          const local = inversePoint(parentWorld, desired, mapping.target);
          values.x = local[0] - targetBone.x;
          values.y = local[1] - targetBone.y;
        }

        if (mapping.mode === "fk-bone" || (mapping.mode === "transform-control" && mapping.sourceEndPath)) {
          const endPath = sourceEnd(mapping, source);
          const bindDirection = project(subtract3(referencePosition(endPath), referencePosition(mapping.sourcePath)));
          const currentDirection = project(subtract3(mappedPosition(current, endPath, false), mappedPosition(current, mapping.sourcePath, false)));
          if (length2(bindDirection) < EPSILON || length2(currentDirection) < EPSILON) {
            values.rotation = 0;
            diagnostics.push({ code: "degenerate-projection", target: mapping.target, message: `Projected ${mapping.sourcePath} → ${endPath} is near zero; using setup direction` });
          } else {
            const sourceDelta = wrapDegrees(angle2(currentDirection) - angle2(bindDirection));
            const setup = setupWorld.get(mapping.target)!;
            const setupAngle = Math.atan2(setup[1], setup[0]);
            const desiredAngle = setupAngle + (sourceDelta + (correction?.rotationDegrees ?? 0)) * RADIANS;
            const desiredWorldAxis: Vec2 = [Math.cos(desiredAngle), Math.sin(desiredAngle)];
            const localAxis = inverseLinear(parentWorld, desiredWorldAxis, mapping.target);
            const localAngle = angle2(localAxis) - (targetBone.scaleX < 0 ? 180 : 0);
            values.rotation = wrapDegrees(localAngle - targetBone.rotation);
          }
        }

        for (const [property, value] of Object.entries(values) as [Key["property"], number][]) {
          if (!Number.isFinite(value)) throw new Error(`Nonfinite ${mapping.target}.${property} at ${sourceSeconds}`);
          keys.push({ target: mapping.target, property, value });
        }
        keyValues.set(mapping.target, values);
      }

      return { seconds: sourceSeconds - rangeStart, keys, diagnostics };
    },
  };
}
