import type { JointPose, MotionSource, TargetBone, TargetSummary, TransferConfig } from "../src/core/contracts.ts";

export type Point3 = readonly [number, number, number];

export function translation([x, y, z]: Point3): readonly number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

export function motion(
  nodes: readonly { path: string; parentPath: string | null; bind: Point3 }[],
  at: (seconds: number, path: string) => Point3,
  durationSeconds = 1,
): MotionSource {
  return {
    joints: nodes.map(({ path, parentPath }) => ({ path, parentPath, name: path.split("/").at(-1) ?? path })),
    clips: [{ id: "clip", name: "clip", durationSeconds }],
    poseAt(_clipId, seconds): readonly JointPose[] {
      return nodes.map(({ path, parentPath, bind }) => ({
        path,
        parentPath,
        world: translation(at(seconds, path)),
        bindWorld: translation(bind),
      }));
    },
  };
}

export function bone(name: string, parent: string | null, overrides: Partial<TargetBone> = {}): TargetBone {
  return { name, parent, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 1, ...overrides };
}

export function target(bones: readonly TargetBone[], constraints: TargetSummary["constraints"] = []): TargetSummary {
  return { editorVersion: "4.3.26", bones, skins: ["default"], animations: [], constraints };
}

export function config(overrides: Partial<TransferConfig> = {}): TransferConfig {
  return {
    schemaVersion: 1,
    source: { file: "source.glb", clipId: "clip", frontAxis: "+Z", upAxis: "+Y", rangeSeconds: [0, 1] },
    target: { file: "target.json", skin: "default", directionId: "front" },
    view: { yawDegrees: 0, pitchDegrees: 0, mirror: false },
    anchors: { sourceFootPath: "root", sourceRootPath: "root", targetFootBone: "root", scale: 1, offsetX: 0, offsetY: 0 },
    mappings: [],
    chainCorrections: [],
    rootPolicy: "in-place-ground",
    sampleHz: 2,
    output: { animationName: "workshop/test_001", directory: "output", spineVersion: "4.3.26" },
    ...overrides,
  };
}
