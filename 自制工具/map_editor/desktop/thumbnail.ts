import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const cache = new Map<string, string>();
let queue = Promise.resolve();
export function thumbnail(row: any, load: () => Promise<any>): Promise<string> {
  const key = row.id + row.hash;
  if (cache.has(key)) return Promise.resolve(cache.get(key)!);
  const promise = queue.then(async () => {
    if (cache.has(key)) return cache.get(key)!;
    const payload = await load();
    if (row.type === "png") {
      const url = "data:image/png;base64," + payload.data;
      cache.set(key, url);
      return url;
    }
    const bytes = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
    const obj = (await new GLTFLoader().parseAsync(bytes.buffer, "")).scene;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#cbd9df");
    scene.add(obj, new THREE.HemisphereLight("#fff8e8", "#667c8b", 3));
    const light = new THREE.DirectionalLight("#fff4d7", 3);
    light.position.set(-2, 4, 3);
    scene.add(light);
    const box = new THREE.Box3().setFromObject(obj),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length() || 1;
    const cam = new THREE.PerspectiveCamera(35, 1, 0.001, size * 10);
    cam.position
      .copy(center)
      .add(
        new THREE.Vector3(1, 0.8, 1.4).normalize().multiplyScalar(size * 1.8),
      );
    cam.lookAt(center);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    try {
      renderer.setSize(120, 90);
      cam.aspect = 120 / 90;
      cam.updateProjectionMatrix();
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL();
      cache.set(key, url);
      if (cache.size > 128) cache.delete(cache.keys().next().value!);
      return url;
    } finally {
      obj.traverse((o: any) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material)
          ? o.material
          : o.material
            ? [o.material]
            : []) {
          for (const v of Object.values(m))
            if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
    }
  });
  queue = promise.then(
    () => {},
    () => {},
  );
  return promise;
}
