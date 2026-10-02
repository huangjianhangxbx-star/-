import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export async function inspectAsset(dialog: HTMLDialogElement, row: any, read: (id: string) => Promise<any>) {
  const heading = dialog.querySelector<HTMLElement>("#asset-viewer-heading")!;
  const meta = dialog.querySelector<HTMLElement>("#asset-viewer-meta")!;
  const host = dialog.querySelector<HTMLElement>("#asset-viewer-stage")!;
  heading.textContent = row.name;
  meta.textContent = `${row.path} · 锚点 ${(row.anchor ?? [0, 0, 0]).join(", ")} m`;
  host.replaceChildren();
  dialog.showModal();
  const result = await read(row.id);
  if (row.type === "png") {
    const img = document.createElement("img");
    img.src = `data:image/png;base64,${result.data}`;
    img.alt = row.name;
    host.append(img);
    meta.textContent += " · PNG 透明贴花";
    return;
  }
  if (row.type !== "glb") throw Error("该文件仅可定位，独立预览使用 GLB 或 PNG");
  const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
  const model = (await new GLTFLoader().parseAsync(bytes.buffer, "")).scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  meta.textContent += ` · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} 米` +
    ` · ${Math.round(size.x / 0.25)} × ${Math.round(size.y / 0.25)} × ${Math.round(size.z / 0.25)} 体素`;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#233846");
  scene.add(model);
  scene.add(new THREE.HemisphereLight("#e9f5ff", "#60717d", 2));
  const sun = new THREE.DirectionalLight("#fff0d3", 2);
  sun.position.set(-3, 6, 5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
  const radius = Math.max(0.5, size.length() * 0.75);
  camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.7, radius));
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.update();
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let frame = 0;
  const draw = () => {
    frame = requestAnimationFrame(draw);
    controls.update();
    renderer.render(scene, camera);
  };
  draw();
  dialog.addEventListener("close", () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
    host.replaceChildren();
    model.traverse((o: any) => {
      o.geometry?.dispose();
      for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])
        material.dispose();
    });
  }, { once: true });
}
