import {
  AnimationState, AnimationStateData, AtlasAttachmentLoader, Color, GLTexture, Physics,
  SceneRenderer, Skeleton, SkeletonJson, TextureAtlas, Vector2,
} from '@esotericsoftware/spine-webgl';
import type { DriverFrame } from '../core/contracts.ts';
import { applyDriverFrameToSkeleton } from './live-frame-preview.ts';

export type SpinePreviewAssets = {
  atlasText: string;
  pages: readonly { name: string; bytes: ArrayBuffer }[];
};

async function imageFromBytes(bytes: ArrayBuffer): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Official Spine 4.3 runtime preview of the complete JSON that is also saved. */
export class Spine43Preview {
  private readonly renderer: SceneRenderer;
  private atlas: TextureAtlas | null = null;
  private skeleton: Skeleton | null = null;
  private data: ReturnType<SkeletonJson['readSkeletonData']> | null = null;
  private skin = '';
  private displayAnimation = '';
  private generatedAnimation = '';
  private liveFrame: DriverFrame | null = null;
  private selectedBone = '';
  private bounds = { x: 0, y: 0, width: 600, height: 600 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('当前系统无法创建 Spine WebGL 预览');
    this.renderer = new SceneRenderer(canvas, gl);
  }

  async load(jsonText: string, assets: SpinePreviewAssets, skin: string, displayAnimation = '', generatedAnimation = ''): Promise<void> {
    this.atlas?.dispose();
    const atlas = new TextureAtlas(assets.atlasText);
    const pages = new Map(assets.pages.map((item) => [item.name, item.bytes]));
    for (const page of atlas.pages) {
      const bytes = pages.get(page.name);
      if (!bytes) throw new Error(`Spine 贴图页缺失：${page.name}`);
      page.setTexture(new GLTexture(this.renderer.context, await imageFromBytes(bytes), page.pma));
    }
    const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(jsonText));
    const skeleton = new Skeleton(data);
    if (skin) skeleton.setSkin(skin);
    this.atlas = atlas;
    this.data = data;
    this.skeleton = skeleton;
    this.skin = skin;
    this.displayAnimation = displayAnimation;
    this.generatedAnimation = generatedAnimation;
    this.liveFrame = null;
    this.evaluate(0);
    const offset = new Vector2(), size = new Vector2();
    skeleton.getBounds(offset, size);
    if (size.x > 0 && size.y > 0) this.bounds = { x: offset.x, y: offset.y, width: size.x, height: size.y };
    this.seek(0);
  }

  setDisplayAnimation(name: string): void {
    this.displayAnimation = name;
  }

  setSelectedBone(name: string): void {
    this.selectedBone = name;
  }

  setLiveFrame(frame: DriverFrame | null): void { this.liveFrame = frame; }

  clearGenerated(): void {
    this.generatedAnimation = '';
    this.liveFrame = null;
  }

  seek(seconds: number): void {
    if (!this.skeleton) return;
    this.evaluate(Math.max(0, seconds));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    const gl = this.renderer.context.gl;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.105, 0.129, 0.141, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const aspect = width / height;
    const worldHeight = Math.max(this.bounds.height * 1.4, this.bounds.width * 1.4 / aspect, 200);
    this.renderer.camera.setViewport(worldHeight * aspect, worldHeight);
    this.renderer.camera.position.set(this.bounds.x + this.bounds.width / 2, this.bounds.y + this.bounds.height / 2, 0);
    this.renderer.begin();
    this.renderer.drawSkeleton(this.skeleton);
    const selected = this.selectedBone ? this.skeleton.findBone(this.selectedBone) : null;
    if (selected) {
      const pose = selected.appliedPose;
      const tint = new Color(0.92, 0.73, 0.43, 1);
      this.renderer.circle(false, pose.worldX, pose.worldY, Math.max(worldHeight * 0.011, 3), tint, 20);
      this.renderer.line(pose.worldX, pose.worldY, pose.worldX + pose.a * selected.data.length, pose.worldY + pose.c * selected.data.length, tint);
    }
    this.renderer.end();
  }

  private evaluate(seconds: number): void {
    if (!this.data || !this.skeleton) return;
    this.skeleton.setupPose();
    const state = new AnimationState(new AnimationStateData(this.data));
    if (this.displayAnimation && this.data.findAnimation(this.displayAnimation)) state.setAnimation(0, this.displayAnimation, true);
    if (this.generatedAnimation && this.data.findAnimation(this.generatedAnimation)) state.setAnimation(1, this.generatedAnimation, false);
    state.update(seconds);
    state.apply(this.skeleton);
    if (this.liveFrame) applyDriverFrameToSkeleton(this.skeleton, this.liveFrame);
    this.skeleton.updateWorldTransform(Physics.reset);
  }
}
