import * as T from "three";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export type DisplayRole = "model" | "paint" | "auxiliary";
export function displayRole(object: T.Object3D): DisplayRole {
  for (let node: T.Object3D | null = object; node; node = node.parent) {
    if (node.userData.surfacePaint) return "paint";
    if (node.userData.viewportRole) return node.userData.viewportRole;
  }
  return "auxiliary";
}
/** Model color/depth -> SSAO -> composite depth -> depth-tested auxiliaries -> sRGB. */
export class ViewportCavity {
  private base = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthTexture: new T.DepthTexture(1, 1),
  });
  private result = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  private ao = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthBuffer: false,
  });
  private pass: SSAOPass;
  private output = new OutputPass();
  private normals = new Map<T.Material, T.MeshNormalMaterial>();
  private invisible = new T.MeshBasicMaterial({ visible: false });
  private composite = new T.ShaderMaterial({
    depthTest: true,
    depthWrite: true,
    uniforms: {
      color: { value: null },
      depth: { value: null },
      ao: { value: null },
      strength: { value: 0.4 },
    },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader:
      "varying vec2 vUv; uniform sampler2D color,depth,ao; uniform float strength; void main(){vec4 c=texture2D(color,vUv);float d=texture2D(depth,vUv).x;float a=texture2D(ao,vUv).r;gl_FragColor=vec4(c.rgb*(1.-strength*(1.-a)),c.a);gl_FragDepth=d;}",
  });
  private quad = new FullScreenQuad(this.composite);
  private size = "";
  private renderer: T.WebGLRenderer;
  private scene: T.Scene;
  private camera: T.Camera;
  constructor(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.pass = new SSAOPass(scene, camera, 1, 1, 16);
    this.pass.output = SSAOPass.OUTPUT.Blur;
    const p = this.pass as any;
    // Fixed low-discrepancy kernel; no random changes during static frames.
    for (let i = 0; i < p.kernel.length; i++) {
      const f = (i + 0.5) / p.kernel.length,
        angle = i * 2.399963;
      p.kernel[i]
        .set(
          Math.cos(angle) * Math.sqrt(1 - f * f),
          Math.sin(angle) * Math.sqrt(1 - f * f),
          f,
        )
        .multiplyScalar(0.1 + 0.9 * f * f);
    }
    const noise = p.noiseTexture.image.data as Float32Array;
    for (let i = 0; i < noise.length; i++)
      noise[i] = ((i * 7 + 3) % 17) / 8 - 1;
    p.noiseTexture.needsUpdate = true;
    p._renderOverride = () => this.renderNormals();
  }
  private normal(source: T.Material) {
    let m = this.normals.get(source);
    if (!m) {
      m = new T.MeshNormalMaterial();
      this.normals.set(source, m);
      const dispose = () => {
        m!.dispose();
        this.normals.delete(source);
        source.removeEventListener("dispose", dispose);
      };
      source.addEventListener("dispose", dispose);
      m.userData.release = dispose;
    }
    const s = source as T.MeshStandardMaterial;
    m.side = s.side;
    m.clippingPlanes = s.clippingPlanes;
    m.clipIntersection = s.clipIntersection;
    return m;
  }
  private renderNormals() {
    const saved: { node: any; visible: boolean; material: any }[] = [];
    const scene = this.scene,
      background = scene.background;
    scene.background = null;
    scene.traverse((node: any) => {
      if (!node.isMesh && !node.isLine && !node.isPoints) return;
      saved.push({ node, visible: node.visible, material: node.material });
      const materials: T.Material[] = Array.isArray(node.material)
        ? node.material
        : [node.material];
      if (
        !node.isMesh ||
        displayRole(node) !== "model" ||
        materials.some((m) => m.transparent || m.opacity < 1)
      ) {
        node.visible = false;
        return;
      }
      node.material = Array.isArray(node.material)
        ? materials.map((m) => this.normal(m))
        : this.normal(materials[0]);
    });
    const color = this.renderer.getClearColor(new T.Color()),
      alpha = this.renderer.getClearAlpha();
    try {
      this.renderer.setRenderTarget(this.pass.normalRenderTarget);
      this.renderer.setClearColor(0x7777ff, 1);
      this.renderer.clear();
      this.renderer.render(scene, this.camera);
    } finally {
      for (const item of saved) {
        item.node.visible = item.visible;
        item.node.material = item.material;
      }
      scene.background = background;
      this.renderer.setClearColor(color, alpha);
    }
  }
  draw(level: "low" | "medium", unit: number) {
    const r = this.renderer,
      size = r.getDrawingBufferSize(new T.Vector2()),
      key = size.toArray().join(":");
    if (key !== this.size) {
      this.size = key;
      this.base.setSize(size.x, size.y);
      this.result.setSize(size.x, size.y);
      const w = Math.max(1, Math.round(size.x * 0.65)),
        h = Math.max(1, Math.round(size.y * 0.65));
      this.ao.setSize(w, h);
      this.pass.setSize(w, h);
    }
    const camera = this.camera as T.PerspectiveCamera,
      p = this.pass as any;
    p.ssaoMaterial.defines.PERSPECTIVE_CAMERA = camera.isPerspectiveCamera
      ? 1
      : 0;
    for (const m of [p.ssaoMaterial, p.depthRenderMaterial]) {
      m.uniforms.cameraNear.value = camera.near;
      m.uniforms.cameraFar.value = camera.far;
    }
    p.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(
      camera.projectionMatrix,
    );
    p.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(
      camera.projectionMatrixInverse,
    );
    this.pass.kernelRadius = unit * 2.8;
    this.pass.minDistance = (unit * 0.025) / (camera.far - camera.near);
    this.pass.maxDistance = (unit * 4) / (camera.far - camera.near);
    const saved: { node: any; visible: boolean; material: any }[] = [];
    const background = this.scene.background,
      auto = r.autoClear,
      target = r.getRenderTarget();
    this.scene.traverse((node: any) => {
      if (node.isMesh || node.isLine || node.isPoints)
        saved.push({ node, visible: node.visible, material: node.material });
    });
    try {
      for (const { node } of saved)
        if (displayRole(node) === "auxiliary") node.visible = false;
      r.autoClear = true;
      r.setRenderTarget(this.base);
      r.render(this.scene, this.camera);
      this.pass.render(r, this.ao, this.ao, 0, false);
      const u = this.composite.uniforms;
      u.color.value = this.base.texture;
      u.depth.value = this.base.depthTexture;
      u.ao.value = this.ao.texture;
      u.strength.value = level === "medium" ? 0.62 : 0.36;
      r.setRenderTarget(this.result);
      r.clear();
      this.quad.render(r);
      for (const item of saved) {
        item.node.visible = item.visible;
        item.node.material =
          displayRole(item.node) === "auxiliary"
            ? item.material
            : this.invisible;
      }
      this.scene.background = null;
      r.autoClear = false;
      r.render(this.scene, this.camera);
      this.output.renderToScreen = true;
      this.output.render(r, this.result, this.result, 0, false);
    } finally {
      for (const item of saved) {
        item.node.visible = item.visible;
        item.node.material = item.material;
      }
      this.scene.background = background;
      r.autoClear = auto;
      r.setRenderTarget(target);
    }
  }
  dispose() {
    this.pass.dispose();
    (this.pass as any).noiseTexture?.dispose();
    (this.pass as any).ssaoMaterial.dispose();
    this.base.dispose();
    this.result.dispose();
    this.ao.dispose();
    this.output.dispose();
    this.composite.dispose();
    this.quad.dispose();
    this.invisible.dispose();
    for (const m of [...this.normals.values()]) m.userData.release();
    this.normals.clear();
  }
}
