import type { TransferConfig } from "../core/contracts.ts";
import { validateSamplingLimits } from "../core/sampling-limits.ts";

function finiteNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} 必须是有限数字`);
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} 缺失或格式不正确`);
  }
  return value as Record<string, unknown>;
}

function nonempty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} 不能为空`);
  }
}

/** Validate a saved workshop config without importing Node-only file APIs. */
export function validateConfig(value: unknown): TransferConfig {
  const config = object(value, "校准配置");
  if (config.schemaVersion !== 1) {
    throw new Error(`不支持的配置版本 schemaVersion=${String(config.schemaVersion)}，需要版本 1`);
  }
  const source = object(config.source, "源动作");
  const target = object(config.target, "目标角色");
  const view = object(config.view, "观察角");
  const anchors = object(config.anchors, "锚点");
  const output = object(config.output, "输出");

  for (const key of ["file", "clipId", "frontAxis", "upAxis"] as const) nonempty(source[key], `源动作 ${key}`);
  if (!Array.isArray(source.rangeSeconds) || source.rangeSeconds.length !== 2) {
    throw new Error("动作时间范围 rangeSeconds 必须有起止秒数");
  }
  finiteNumber(source.rangeSeconds[0], "动作起点");
  finiteNumber(source.rangeSeconds[1], "动作终点");
  if (source.rangeSeconds[0] < 0 || source.rangeSeconds[1] <= source.rangeSeconds[0]) {
    throw new Error("动作终点必须晚于非负的动作起点");
  }
  if (source.referenceSeconds !== undefined) finiteNumber(source.referenceSeconds, "参考帧");
  for (const key of ["file", "skin", "directionId"] as const) nonempty(target[key], `目标角色 ${key}`);
  finiteNumber(view.yawDegrees, "水平角 yawDegrees");
  finiteNumber(view.pitchDegrees, "俯角 pitchDegrees");
  if (typeof view.mirror !== "boolean") throw new Error("镜像 mirror 必须为开或关");
  for (const key of ["sourceFootPath", "targetFootBone"] as const) nonempty(anchors[key], `锚点 ${key}`);
  if (anchors.sourceRootPath !== undefined) nonempty(anchors.sourceRootPath, "运动根 sourceRootPath");
  for (const key of ["scale", "offsetX", "offsetY"] as const) finiteNumber(anchors[key], `锚点 ${key}`);
  if ((anchors.scale as number) <= 0) throw new Error("转换比例 scale 必须大于零");
  if (!Array.isArray(config.mappings)) throw new Error("骨骼映射 mappings 必须是列表");
  for (const [index, entry] of config.mappings.entries()) {
    const mapping = object(entry, `第 ${index + 1} 条映射`);
    nonempty(mapping.sourcePath, `第 ${index + 1} 条映射源骨`);
    nonempty(mapping.target, `第 ${index + 1} 条映射目标`);
    if (mapping.sourceEndPath !== undefined) nonempty(mapping.sourceEndPath, `第 ${index + 1} 条映射终点`);
    if (!["fk-bone", "ik-target", "transform-control", "skip"].includes(String(mapping.mode))) {
      throw new Error(`第 ${index + 1} 条映射驱动模式不受支持`);
    }
    if (!["left", "right", "center"].includes(String(mapping.side))) {
      throw new Error(`第 ${index + 1} 条映射左右标记不受支持`);
    }
  }
  if (!Array.isArray(config.chainCorrections)) throw new Error("局部修正 chainCorrections 必须是列表");
  for (const [index, entry] of config.chainCorrections.entries()) {
    const correction = object(entry, `第 ${index + 1} 条局部修正`);
    nonempty(correction.target, `第 ${index + 1} 条局部修正目标`);
    for (const key of ["rotationDegrees", "offsetX", "offsetY"] as const) {
      if (correction[key] !== undefined) finiteNumber(correction[key], `局部修正 ${key}`);
    }
  }
  if (config.rootPolicy !== "in-place-ground") throw new Error("不支持的根位移策略 rootPolicy");
  finiteNumber(config.sampleHz, "采样率 sampleHz");
  validateSamplingLimits(config.sampleHz, source.rangeSeconds as [number, number]);
  for (const key of ["animationName", "directory", "spineVersion"] as const) nonempty(output[key], `输出 ${key}`);
  return value as TransferConfig;
}
