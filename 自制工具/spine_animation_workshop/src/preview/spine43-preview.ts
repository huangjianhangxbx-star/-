import {
  AnimationState, AnimationStateData, AtlasAttachmentLoader, Color, GLTexture, Physics,
  SceneRenderer, Skeleton, SkeletonJson, TextureAtlas, Vector2,
} from '@esotericsoftware/spine-webgl';
import type { DriverFrame } from '../core/contracts.ts';
import { applyDriverFrameToSkeleton } from './live-frame-preview.ts';
import type { RigSelection } from '../analysis/rig-profile.ts';

type PreviewBounds = { x: number; y: number; width: number; height: number };
type RigOverlay = { lines: number[][]; anchor: { x: number; y: number }; ground: { x: number; y: number } | null; bounds: PreviewBounds };

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
  private rigSelection: RigSelection | null = null;
  private directionBones: Set<string> | null = null;
  private rigOverlay: RigOverlay | null = null;
  private lastSeconds = 0;
  private bounds = { x: 0, y: 0, width: 600, height: 600 };
  private loadRevision = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('当前系统无法创建 Spine WebGL 预览');
    this.renderer = new SceneRenderer(canvas, gl);
  }

  async load(jsonText: string, assets: SpinePreviewAssets, skin: string, displayAnimation = '', generatedAnimation = ''): Promise<void> {
    const revision = ++this.loadRevision;
    const atlas = new TextureAtlas(assets.atlasText);
    let adopted = false;
    try {
      const pages = new Map(assets.pages.map((item) => [item.name, item.bytes]));
      for (const page of atlas.pages) {
        const bytes = pages.get(page.name);
        if (!bytes) throw new Error(`Spine 贴图页缺失：${page.name}`);
        const image = await imageFromBytes(bytes);
        if (revision !== this.loadRevision) return;
        page.setTexture(new GLTexture(this.renderer.context, image, page.pma));
      }
      if (revision !== this.loadRevision) return;
      const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(jsonText));
      const skeleton = new Skeleton(data);
      if (skin) skeleton.setSkin(skin);
      const previousAtlas = this.atlas;
      this.atlas = atlas;
      this.data = data;
      this.skeleton = skeleton;
      this.skin = skin;
      this.displayAnimation = displayAnimation;
      this.generatedAnimation = generatedAnimation;
      this.liveFrame = null;
      if (this.rigSelection && (!skeleton.findBone(this.rigSelection.directionRoot) || !skeleton.findBone(this.rigSelection.bodyAnchor))) this.rigSelection = null;
      this.directionBones = this.rigSelection ? this.collectDirectionBones(this.rigSelection, skeleton) : null;
      this.rigOverlay = this.rigSelection ? this.createRigOverlay(this.rigSelection) : null;
      adopted = true;
      this.evaluate(0);
      this.bounds = this.measureBounds(skeleton, this.rigOverlay?.bounds ?? this.bounds);
      this.seek(0);
      previousAtlas?.dispose();
    } catch (error) {
      if (revision === this.loadRevision) throw error;
    } finally {
      if (!adopted) atlas.dispose();
    }
  }

  setDisplayAnimation(name: string): void {
    this.displayAnimation = name;
  }

  setSelectedBone(name: string): void {
    this.selectedBone = name;
  }

  /** Preview-only visibility and framing; the loaded project and animation data stay intact. */
  setRigSelection(selection: RigSelection | null): void {
    const names = selection && this.skeleton ? this.collectDirectionBones(selection, this.skeleton) : null;
    this.rigSelection = selection ? structuredClone(selection) : null;
    this.directionBones = names;
    this.rigOverlay = selection ? this.createRigOverlay(selection) : null;
    if (this.skeleton) {
      this.evaluate(0);
      this.bounds = this.measureBounds(this.skeleton, this.rigOverlay?.bounds ?? this.bounds);
      this.seek(this.lastSeconds ?? 0);
    }
  }

  setLiveFrame(frame: DriverFrame | null): void { this.liveFrame = frame; }

  clearGenerated(): void {
    this.generatedAnimation = '';
    this.liveFrame = null;
  }

  seek(seconds: number): void {
    if (!this.skeleton) return;
    this.lastSeconds = Math.max(0, seconds);
    this.evaluate(this.lastSeconds);
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
    if (this.rigOverlay) {
      const tint = new Color(0.35, 0.72, 0.74, 0.72), anchorTint = new Color(0.96, 0.76, 0.41, 0.95);
      const overlay = this.rigOverlay, frame = overlay.bounds;
      this.renderer.rect(false, frame.x, frame.y, frame.width, frame.height, tint);
      for (const line of overlay.lines) this.renderer.line(line[0]!, line[1]!, line[2]!, line[3]!, tint);
      this.renderer.circle(false, overlay.anchor.x, overlay.anchor.y, Math.max(worldHeight * 0.012, 3), anchorTint, 20);
      if (overlay.ground) {
        const radius = Math.max(worldHeight * 0.016, 4);
        this.renderer.line(overlay.ground.x - radius, overlay.ground.y, overlay.ground.x + radius, overlay.ground.y, tint);
        this.renderer.line(overlay.ground.x, overlay.ground.y - radius, overlay.ground.x, overlay.ground.y + radius, tint);
      }
    }
    const selectedVisible = !this.directionBones || this.directionBones.has(this.selectedBone) || this.rigSelection?.sharedBones.includes(this.selectedBone);
    const selected = this.selectedBone && selectedVisible ? this.skeleton.findBone(this.selectedBone) : null;
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
    this.hideOtherDirections(this.skeleton);
  }

  private collectDirectionBones(selection: RigSelection, skeleton: Skeleton): Set<string> {
    const root = skeleton.findBone(selection.directionRoot);
    if (!root) throw new Error(`方向入口不存在：${selection.directionRoot}`);
    const names = new Set<string>();
    const visit = (bone: (typeof skeleton.bones)[number]): void => { names.add(bone.data.name); for (const child of bone.children) visit(child); };
    visit(root);
    if (!names.has(selection.bodyAnchor)) throw new Error('身体参考点必须属于选定方向分支');
    for (const name of selection.normalizationBones ?? []) if (!names.has(name)) throw new Error(`身体尺寸骨不属于选定方向：${name}`);
    if (selection.groundAnchor && !names.has(selection.groundAnchor) && !selection.sharedBones.includes(selection.groundAnchor)) throw new Error('脚底参考点不属于选定方向或共享控制骨');
    return names;
  }

  private hideOtherDirections(skeleton: Skeleton): void {
    if (this.directionBones) for (const slot of skeleton.slots) if (!this.directionBones.has(slot.bone.data.name)) slot.appliedPose.attachment = null;
  }

  private measureBounds(skeleton: Skeleton, fallback: PreviewBounds): PreviewBounds {
    const offset = new Vector2(), size = new Vector2(); skeleton.getBounds(offset, size);
    return size.x > 0 && size.y > 0 && [offset.x, offset.y, size.x, size.y].every(Number.isFinite)
      ? { x: offset.x, y: offset.y, width: size.x, height: size.y } : fallback;
  }

  private createRigOverlay(selection: RigSelection): RigOverlay | null {
    if (!this.data) return null;
    const setup = new Skeleton(this.data); if (this.skin) setup.setSkin(this.skin); setup.setupPose(); setup.updateWorldTransform(Physics.reset);
    this.hideOtherDirections(setup);
    const anchor = setup.findBone(selection.bodyAnchor)!.appliedPose;
    const core = (selection.normalizationBones?.length ? selection.normalizationBones : [selection.bodyAnchor]).map(name => setup.findBone(name)!).filter(Boolean);
    const lines = core.map(b => { const p = b.appliedPose; return [p.worldX, p.worldY, p.worldX + p.a * b.data.length, p.worldY + p.c * b.data.length]; });
    const xs = core.map(b => b.appliedPose.worldX), ys = core.map(b => b.appliedPose.worldY);
    const fallback = { x: Math.min(...xs) - 20, y: Math.min(...ys) - 20, width: Math.max(40, Math.max(...xs) - Math.min(...xs) + 40), height: Math.max(40, Math.max(...ys) - Math.min(...ys) + 40) };
    const ground = selection.groundAnchor ? setup.findBone(selection.groundAnchor)?.appliedPose : null;
    return { lines, anchor: { x: anchor.worldX, y: anchor.worldY }, ground: ground ? { x: ground.worldX, y: ground.worldY } : null, bounds: this.measureBounds(setup, fallback) };
  }
}
