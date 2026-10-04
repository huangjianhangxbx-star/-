import type { Vec3 } from "./workshop-documents.ts";

function vector(point: Vec3): void {
  if (
    !Array.isArray(point) ||
    point.length !== 3 ||
    !point.every(Number.isFinite)
  )
    throw new Error("源坐标必须是三个有限米坐标");
}
function rotate(point: Vec3, angle: number): Vec3 {
  if (
    !Number.isSafeInteger(angle) ||
    angle % 90 !== 0 ||
    Math.abs(angle) > 360000
  )
    throw new Error("旋转必须是范围内的90度整数倍");
  const [x, y, z] = point;
  switch ((((angle / 90) % 4) + 4) % 4) {
    case 0:
      return [x, y, z];
    case 1:
      return [-y, x, z];
    case 2:
      return [-x, -y, z];
    default:
      return [y, -x, z];
  }
}
export function sourceToThree(point: Vec3): Vec3 {
  vector(point);
  return [point[0], point[2], -point[1]];
}
export function sourceToUnity(point: Vec3): Vec3 {
  vector(point);
  return [point[0], point[2], point[1]];
}
export function transformPoint(
  point: Vec3,
  anchorM: Vec3,
  positionM: Vec3,
  rotationDeg: number,
): Vec3 {
  vector(point);
  vector(anchorM);
  vector(positionM);
  const local = rotate(
    point.map((n, i) => n - anchorM[i]) as Vec3,
    rotationDeg,
  );
  return local.map((n, i) => n + positionM[i]) as Vec3;
}
export function isVoxelAligned(
  anchorM: Vec3,
  positionM: Vec3,
  rotationDeg: number,
): boolean {
  const origin = transformPoint([0, 0, 0], anchorM, positionM, rotationDeg);
  return origin.every((n) => Math.abs(n - Math.round(n / 0.25) * 0.25) <= 1e-6);
}
