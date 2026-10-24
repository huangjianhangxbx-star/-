import type { MotionSource, TransferConfig } from '../core/contracts.ts';

type Vec3 = readonly [number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const axis = (value: string): Vec3 => {
  const sign = value.startsWith('-') ? -1 : 1;
  if (value.endsWith('X')) return [sign, 0, 0];
  if (value.endsWith('Y')) return [0, sign, 0];
  return [0, 0, sign];
};

/** Canvas view of actual 3D joint positions; no alternate animation solver. */
export class SourcePreview {
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法初始化源骨架画布');
    this.context = context;
  }

  clear(message = '载入 GLB 后显示源动作'): void {
    const { width, height } = this.size();
    const ctx = this.context;
    ctx.fillStyle = '#1b2124';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#8f9a9b';
    ctx.font = '14px Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
  }

  render(source: MotionSource, config: TransferConfig, seconds: number, selectedPath = ''): void {
    const { width, height } = this.size();
    const ctx = this.context;
    ctx.fillStyle = '#1b2124';
    ctx.fillRect(0, 0, width, height);
    const yaw = config.view.yawDegrees * Math.PI / 180;
    const pitch = config.view.pitchDegrees * Math.PI / 180;
    const up = axis(config.source.upAxis);
    const front = axis(config.source.frontAxis);
    const side = cross(up, front);
    const horizontal: Vec3 = [front[0] * Math.cos(yaw) + side[0] * Math.sin(yaw), front[1] * Math.cos(yaw) + side[1] * Math.sin(yaw), front[2] * Math.cos(yaw) + side[2] * Math.sin(yaw)];
    const right = cross(up, horizontal);
    const screenUp: Vec3 = [up[0] * Math.cos(pitch) - horizontal[0] * Math.sin(pitch), up[1] * Math.cos(pitch) - horizontal[1] * Math.sin(pitch), up[2] * Math.cos(pitch) - horizontal[2] * Math.sin(pitch)];
    const pose = source.poseAt(config.source.clipId, seconds);
    const project = (world: readonly number[]): readonly [number, number] => {
      const position: Vec3 = [world[12], world[13], world[14]];
      return [dot(position, right) * (config.view.mirror ? -1 : 1), dot(position, screenUp)];
    };
    const points = pose.map((joint) => project(joint.world));
    if (!points.length) return this.clear('源动作无关节');
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 0.1);
    const scale = Math.min(width, height) * 0.72 / span;
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const screen = (point: readonly [number, number]): readonly [number, number] => [width / 2 + (point[0] - centerX) * scale, height / 2 - (point[1] - centerY) * scale];

    ctx.strokeStyle = '#303c40';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height * 0.82); ctx.lineTo(width, height * 0.82); ctx.stroke();
    const byPath = new Map(pose.map((joint, index) => [joint.path, index]));
    ctx.strokeStyle = '#c4b391';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pose.forEach((joint, index) => {
      const parentIndex = joint.parentPath ? byPath.get(joint.parentPath) : undefined;
      if (parentIndex === undefined) return;
      const from = screen(points[parentIndex]), to = screen(points[index]);
      ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]);
    });
    ctx.stroke();
    pose.forEach((joint, index) => {
      const point = screen(points[index]);
      const selected = joint.path === selectedPath;
      ctx.fillStyle = selected ? '#e6ba6b' : index === 0 ? '#e3d2ad' : '#8ca1a3';
      ctx.beginPath(); ctx.arc(point[0], point[1], selected ? 6 : index === 0 ? 4 : 2.6, 0, Math.PI * 2); ctx.fill();
    });
  }

  private size(): { width: number; height: number } {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    return { width, height };
  }
}
