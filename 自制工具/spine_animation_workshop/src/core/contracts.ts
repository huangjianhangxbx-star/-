/** Shared data contracts. Time is seconds; angles are degrees; matrices are column-major. */
export type Matrix16 = readonly number[];

export type JointPose = {
  path: string;
  parentPath: string | null;
  world: Matrix16;
  bindWorld: Matrix16;
};

export type MotionClip = { id: string; name: string; durationSeconds: number };

export type MotionSource = {
  joints: readonly { path: string; parentPath: string | null; name: string }[];
  clips: readonly MotionClip[];
  poseAt(clipId: string, seconds: number): readonly JointPose[];
};

export type TargetBone = {
  name: string;
  parent: string | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  length: number;
  transform?: string;
};

export type TargetSummary = {
  editorVersion: string;
  bones: readonly TargetBone[];
  skins: readonly string[];
  animations: readonly string[];
  constraints: readonly {
    kind: "ik" | "transform" | "path" | "physics";
    name: string;
    bones: readonly string[];
    target: string | null;
    source?: string | null;
  }[];
};

export type DriverMapping = {
  sourcePath: string;
  /** Optional segment endpoint for a stable projected direction (especially at forks). */
  sourceEndPath?: string;
  target: string;
  mode: "fk-bone" | "ik-target" | "transform-control" | "skip";
  side: "left" | "right" | "center";
};

export type TransferConfig = {
  schemaVersion: 1;
  source: {
    file: string;
    clipId: string;
    frontAxis: string;
    upAxis: string;
    rangeSeconds: readonly [number, number];
    referenceSeconds?: number;
  };
  target: { file: string; skin: string; directionId: string; displayAnimation?: string };
  view: { yawDegrees: number; pitchDegrees: number; mirror: boolean };
  anchors: {
    sourceFootPath: string;
    sourceRootPath?: string;
    targetFootBone: string;
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  mappings: readonly DriverMapping[];
  chainCorrections: readonly { target: string; rotationDegrees?: number; offsetX?: number; offsetY?: number }[];
  rootPolicy: "in-place-ground";
  sampleHz: number;
  output: { animationName: string; directory: string; spineVersion: string };
};

export type DriverFrame = {
  seconds: number;
  /** Values use Spine animation timeline semantics, relative to target setup pose. */
  keys: readonly {
    target: string;
    property: "x" | "y" | "rotation" | "scaleX" | "scaleY" | "ikMix";
    value: number;
  }[];
  diagnostics: readonly { code: string; target: string; message: string }[];
};

export type GeneratedClip = {
  name: string;
  durationSeconds: number;
  frames: readonly DriverFrame[];
};
