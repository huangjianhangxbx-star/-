import type { TargetBone, TargetSummary, TransferConfig } from "./contracts.ts";

/** Names describe Spine objects; the source/target paths stay in their original skeletons. */
export type SpineObjectKind = "bone" | "slot" | "ik" | "transform" | "path" | "physics" | "attachment" | "event";
export type SpineDependencyKind = SpineObjectKind | "drawOrder" | "unknown";
export type SpineSide = "left" | "right" | "center" | "unknown";
export type SpineDrive = "direct" | "fk-bone" | "ik-target" | "transform-control" | "skip";

type BaseObjectMapping = {
  source: string;
  target: string;
  side: SpineSide;
  drive: SpineDrive;
  /** Undefined means all channels on this object; explicit lists narrow that choice. */
  channels?: readonly string[];
};

/** Attachment names are only unique within a skin and slot. */
export type SpineObjectMapping =
  | (BaseObjectMapping & {
      kind: "attachment";
      sourceSkin: string;
      sourceSlot: string;
      targetSkin: string;
      targetSlot: string;
    })
  | (BaseObjectMapping & { kind: Exclude<SpineObjectKind, "attachment"> });

export type SpineLocalCorrection = {
  kind: SpineObjectKind;
  target: string;
  channel: string;
  /** The correction is applied to target-local timeline values, never preview coordinates. */
  rotationDegrees?: number;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
};

export type SpineChannelPolicy = {
  /** Omit for a character-pair-wide decision; set to narrow a skip to one action. */
  sourceAnimation?: string;
  kind: SpineDependencyKind;
  source: string;
  channel: string;
  decision: "copy" | "skip" | "unsupported";
  reason: string;
  sourceSkin?: string;
  sourceSlot?: string;
};

export type SpineFileIdentity = {
  jsonFile: string;
  atlasFile: string;
  pageFiles: readonly string[];
  /** Stable while only animation timelines are edited. */
  skeletonFingerprint: string;
  /** Complete export identity, independent of skeleton compatibility. */
  fileHash?: string;
};

/** Target skeleton slot offsets authored for one action; source drawOrder remains independently audited. */
export type SpineTargetDrawOrderKey = {
  time: number;
  offsets?: readonly { slot: string; offset: number }[];
};

export type SpineAnimationJob = {
  sourceAnimation: string;
  rangeSeconds: readonly [number, number];
  outputName: string;
  corrections: readonly SpineLocalCorrection[];
  targetDrawOrderKeys?: readonly SpineTargetDrawOrderKey[];
};

export type SpineTransferConfig = {
  schemaVersion: 2;
  sourceKind: "spine";
  source: SpineFileIdentity;
  target: SpineFileIdentity;
  sourceDirection: string;
  targetDirection: string;
  sourceSkin: string;
  targetSkin: string;
  targetDisplayAnimation?: string;
  /** Reused across all jobs for this character pair and direction. */
  objectMappings: readonly SpineObjectMapping[];
  calibration: {
    rootScaleX: number;
    rootScaleY: number;
    corrections: readonly SpineLocalCorrection[];
  };
  /** A job only adds its own clip selection, output name and local corrections. */
  animationJobs: readonly SpineAnimationJob[];
  channelPolicies: readonly SpineChannelPolicy[];
};

export type WorkshopConfig = TransferConfig | SpineTransferConfig;

export type SpineAnimationSummary = { name: string; durationSeconds: number };
export type SpineSourceSlot = { name: string; bone: string; attachment: string | null };
export type SpineSourceSkin = { name: string; slotNames: readonly string[]; attachmentCount: number };
export type SpineChannelDependency = {
  /** Exact top-level JSON animation category, for structural rewriting. */
  category: string;
  kind: SpineDependencyKind;
  source: string;
  channel: string;
  keyCount: number;
  lastKeySeconds: number;
  /** Some official exports contain out-of-order keys; exact copy may retain them, crop must inspect them. */
  chronological: boolean;
  sourceSkin?: string;
  sourceSlot?: string;
};

export type SpineSourceSummary = {
  editorVersion: string;
  bones: readonly TargetBone[];
  slots: readonly SpineSourceSlot[];
  skins: readonly SpineSourceSkin[];
  constraints: TargetSummary["constraints"];
  animations: readonly SpineAnimationSummary[];
  candidateDirectionPrefixes: readonly { prefix: string; attachmentCount: number; visibleSetupSlots: number }[];
  skeletonFingerprint: string;
  fileHash: string;
};

export type SpineSourceReadResult = {
  summary: SpineSourceSummary;
  document: unknown;
  animationDependencies: Readonly<Record<string, readonly SpineChannelDependency[]>>;
};
