type Vec3 = readonly [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function axis(value: string): Vec3 {
  const sign = value.startsWith('-') ? -1 : 1;
  if (value.endsWith('X')) return [sign, 0, 0];
  if (value.endsWith('Y')) return [0, sign, 0];
  if (value.endsWith('Z')) return [0, 0, sign];
  throw new Error(`未知的坐标轴：${value}`);
}

/** Same orientation convention as the source joint projection and transfer view. */
export function sourceCameraBasis(frontAxis: string, upAxis: string, yawDegrees: number, pitchDegrees: number): {
  view: Vec3; right: Vec3; screenUp: Vec3;
} {
  const front = axis(frontAxis), up = axis(upAxis);
  const side = cross(up, front);
  if (!side.some((value) => value !== 0)) throw new Error('朝前轴和向上轴不能重合');
  const yaw = yawDegrees * Math.PI / 180, pitch = pitchDegrees * Math.PI / 180;
  const horizontal: Vec3 = [0, 1, 2].map((i) => front[i] * Math.cos(yaw) + side[i] * Math.sin(yaw)) as unknown as Vec3;
  const view: Vec3 = [0, 1, 2].map((i) => horizontal[i] * Math.cos(pitch) + up[i] * Math.sin(pitch)) as unknown as Vec3;
  const screenUp: Vec3 = [0, 1, 2].map((i) => up[i] * Math.cos(pitch) - horizontal[i] * Math.sin(pitch)) as unknown as Vec3;
  return { view, right: cross(up, horizontal), screenUp };
}
