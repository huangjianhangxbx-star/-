import * as T from "three";
import { ViewportDisplayController } from "../desktop/viewport-display-controller.ts";
import { SurfacePaintLayer } from "../desktop/surface-paint-layer.ts";
const host = document.querySelector("main")!;
const scene = new T.Scene();
const renderer = new T.WebGLRenderer({
  preserveDrawingBuffer: true,
  antialias: true,
});
renderer.setSize(640, 480);
host.append(renderer.domElement);
let camera: T.PerspectiveCamera | T.OrthographicCamera =
  new T.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
camera.position.set(5, 5, 8);
camera.lookAt(0, 0, 0);
const group = new T.Group();
group.userData.viewportRole = "model";
scene.add(group);
for (const [p, s] of [
  [
    [0, -0.6, 0],
    [5, 0.3, 3],
  ],
  [
    [-2, 0, 0],
    [0.3, 1.5, 3],
  ],
  [
    [2, 0, 0],
    [0.3, 1.5, 3],
  ],
  [
    [0, 0, -1.4],
    [4, 1.5, 0.3],
  ],
] as [number[], number[]][]) {
  const mesh = new T.Mesh(
    new T.BoxGeometry(...(s as [number, number, number])),
    new T.MeshStandardMaterial({ color: "#404040", roughness: 1 }),
  );
  mesh.position.fromArray(p);
  group.add(mesh);
}
let display = new ViewportDisplayController({
  renderer,
  scene,
  camera,
  host,
  id: "edit",
  target: () => new T.Vector3(),
});
let paint: SurfacePaintLayer | null = null;
let paintOpacity = 1;
let pairAsset: any;
function paintPair() {
  group.clear();
  paint?.dispose();
  paint = new SurfacePaintLayer(scene, () => paintOpacity);
  const asset: any = {
    palette: ["#808080"],
    sideColor: 0,
    canvases: [
      {
        canvasId: "pair",
        visible: true,
        voxelStepM: 0.25,
        originTicks: [0, 0, 0],
        cells: [
          { x: 0, y: 0, z: 0, color: 0 },
          { x: 1, y: 0, z: 0, color: 0 },
        ],
        paintSource: {
          schema: "xinghai-surface-paint-1",
          density: 64,
          faces: { "1,0,0,4": { "0": "#808080" } },
        },
      },
    ],
  };
  for (let i = 0; i < 2; i++) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(0.25, 0.25, 0.25),
      new T.MeshStandardMaterial({ color: "#808080", roughness: 1 }),
    );
    mesh.position.set(i * 0.25 + 0.125, 0.125, -0.125);
    group.add(mesh);
  }
  pairAsset = asset;
  paint.update(asset);
  camera.position.set(0.25, 4, -0.125);
  camera.up.set(0, 0, -1);
  camera.lookAt(0.25, 0, -0.125);
  if (camera instanceof T.OrthographicCamera) camera.zoom = 8;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return [0.125, 0.375].map((x) => {
    const v = new T.Vector3(x, 0.25, -0.125).project(camera);
    return [Math.round((v.x + 1) * 320), Math.round((1 - v.y) * 240)];
  });
}
(window as any).paintPair = paintPair;
(window as any).paintOpacity = (value: number) => {
  paintOpacity = value;
  paint!.update(pairAsset);
  return (paint!.group.children[0] as T.Mesh).material;
};
(window as any).project = (point: number[]) => {
  const v = new T.Vector3().fromArray(point).project(camera);
  return [Math.round((v.x + 1) * 320), Math.round((1 - v.y) * 240)];
};
(window as any).axis = (axis: number) => {
  const directions = [
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
    [-1, 0, 0],
    [1, 0, 0],
  ];
  camera.position.fromArray(directions[axis]).multiplyScalar(8);
  camera.up.set(0, axis < 2 ? 0 : 1, axis === 0 ? -1 : axis === 1 ? 1 : 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
};
(window as any).scale = (step: number) => {
  const scale = step / 0.25;
  group.scale.setScalar(scale);
  if (camera instanceof T.OrthographicCamera) camera.zoom = 1 / scale;
  camera.updateProjectionMatrix();
  display.context.unit = () => step;
};
(window as any).clip = (enabled: boolean) =>
  (renderer.clippingPlanes = enabled
    ? [new T.Plane(new T.Vector3(-1, 0, 0), 0)]
    : []);
(window as any).transparent = (enabled: boolean) =>
  group.traverse((node: any) => {
    if (node.isMesh) {
      node.material.opacity = enabled ? 0.3 : 1;
      node.material.transparent = enabled;
      node.material.depthWrite = !enabled;
    }
  });
(window as any).fixture = {
  renderer,
  scene,
  get display() {
    return display;
  },
  render: (state: any) => {
    display.set(state);
    display.draw();
    return renderer.domElement.toDataURL();
  },
  camera: (perspective: boolean) => {
    display.dispose();
    camera = perspective
      ? new T.PerspectiveCamera(42, 640 / 480, 0.1, 100)
      : new T.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.position.set(5, 5, 8);
    camera.lookAt(0, 0, 0);
    display = new ViewportDisplayController({
      renderer,
      scene,
      camera,
      host,
      id: "edit",
      target: () => new T.Vector3(),
    });
  },
  colors: () => {
    group.clear();
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    for (const [i, color] of [
      "#404040",
      "#808080",
      "#c0c0c0",
      "#b04868",
      "#38a8bc",
    ].entries()) {
      const m = new T.Mesh(
        new T.PlaneGeometry(1, 2),
        new T.MeshStandardMaterial({ color }),
      );
      m.position.x = (i - 2) * 1.3;
      group.add(m);
    }
    return (window as any).fixture.render({
      preset: "albedo",
      cavity: "off",
      grid: false,
    });
  },
};
