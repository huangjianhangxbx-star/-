import { transformPoint } from "./coordinates.ts";
import type { Vec3 } from "./workshop-documents.ts";
/** Snap geometry phase, preserving intentional half-grid legacy instance origins. */
export function snapInstancePosition(
  positionM: Vec3,
  anchorM: Vec3,
  rotationDeg: number,
): Vec3 {
  const rotatedRoot = transformPoint(
    anchorM,
    [0, 0, 0],
    [0, 0, 0],
    rotationDeg,
  );
  transformPoint(positionM, [0, 0, 0], [0, 0, 0], 0);
  return positionM.map(
    (v, i) => Math.round((v - rotatedRoot[i]) / 0.25) * 0.25 + rotatedRoot[i],
  ) as Vec3;
}
