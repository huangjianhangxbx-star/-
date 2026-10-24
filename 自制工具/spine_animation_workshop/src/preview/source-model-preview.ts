import { AnimationMixer, Box3, Color, DirectionalLight, LoopOnce, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, SphereGeometry, Vector3, WebGLRenderer, AmbientLight, type AnimationAction, type Object3D, type Quaternion } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { MotionSource, TransferConfig } from '../core/contracts.ts';
import { sourceCameraBasis } from './source-camera.ts';

/** Full GLB mesh preview. It reads the original bytes, while conversion keeps its independent motion-only loader. */
export class SourceModelPreview {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10000);
  private readonly marker = new Mesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color: 0xe6ba6b, depthTest: false }));
  private mixer: AnimationMixer | null = null;
  private actions: AnimationAction[] = [];
  private defaults: { object: Object3D; position: Vector3; quaternion: Quaternion; scale: Vector3 }[] = [];
  private model: Object3D | null = null;
  private center = new Vector3();
  private radius = 1;
  private hasMesh = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setClearColor(new Color('#1b2124'));
    this.scene.add(new AmbientLight(0xffffff, 2.0));
    const key = new DirectionalLight(0xffead2, 2.4); key.position.set(3, 5, 4); this.scene.add(key);
    const fill = new DirectionalLight(0xb4ccdf, 1.1); fill.position.set(-3, 1, -4); this.scene.add(fill);
    this.marker.renderOrder = 999;
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  get ready(): boolean { return this.hasMesh; }

  async load(bytes: ArrayBuffer): Promise<boolean> {
    this.reset();
    const gltf = await new GLTFLoader().parseAsync(bytes.slice(0), '');
    let meshCount = 0;
    gltf.scene.traverse((object) => { if ((object as Mesh).isMesh) meshCount++; });
    if (!meshCount) return false;
    this.model = gltf.scene;
    this.scene.add(gltf.scene);
    gltf.scene.traverse((object) => this.defaults.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() }));
    this.mixer = new AnimationMixer(gltf.scene);
    this.actions = gltf.animations.map((clip) => {
      const action = this.mixer!.clipAction(clip);
      action.setLoop(LoopOnce, 0);
      action.clampWhenFinished = true;
      return action;
    });
    const bounds = new Box3().setFromObject(gltf.scene);
    bounds.getCenter(this.center);
    const size = bounds.getSize(new Vector3());
    this.radius = Math.max(size.length() * 0.65, 0.5);
    this.marker.scale.setScalar(Math.max(this.radius * 0.035, 0.02));
    this.hasMesh = true;
    return true;
  }

  render(motion: MotionSource, config: TransferConfig, seconds: number, selectedPath = ''): void {
    if (!this.hasMesh || !this.model || !this.mixer) return;
    const index = motion.clips.findIndex((clip) => clip.id === config.source.clipId);
    if (index < 0 || !this.actions[index]) throw new Error('源模型预览找不到选中的动作片段');
    this.mixer.stopAllAction();
    for (const item of this.defaults) {
      item.object.position.copy(item.position);
      item.object.quaternion.copy(item.quaternion);
      item.object.scale.copy(item.scale);
    }
    this.actions[index].reset().play();
    this.mixer.setTime(Math.max(0, seconds));
    this.model.updateMatrixWorld(true);
    const selected = selectedPath ? motion.poseAt(config.source.clipId, seconds).find((joint) => joint.path === selectedPath) : undefined;
    this.marker.visible = !!selected;
    if (selected) this.marker.position.set(selected.world[12], selected.world[13], selected.world[14]);
    const { view, screenUp } = sourceCameraBasis(config.source.frontAxis, config.source.upAxis, config.view.yawDegrees, config.view.pitchDegrees);
    const direction = new Vector3(...view);
    this.camera.position.copy(this.center).addScaledVector(direction, this.radius * 3.5);
    this.camera.up.set(...screenUp);
    this.camera.lookAt(this.center);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 2)));
    if (this.canvas.width !== width || this.canvas.height !== height) this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = this.radius * 1.35;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.canvas.style.transform = config.view.mirror ? 'scaleX(-1)' : '';
    this.renderer.render(this.scene, this.camera);
  }

  private reset(): void {
    if (this.model) this.scene.remove(this.model);
    this.model = null;
    this.mixer = null;
    this.actions = [];
    this.defaults = [];
    this.hasMesh = false;
    this.marker.visible = false;
  }
}
