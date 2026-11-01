import { build } from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
const output = await fs.mkdtemp(
  path.resolve("validation/orbit-axis-navigation-"),
);
await fs.writeFile(
  path.join(output, "entry.js"),
  `
import * as THREE from 'three';
import {MapView} from ${JSON.stringify(path.resolve("desktop/view.ts"))};
import {AssemblyView} from ${JSON.stringify(path.resolve("desktop/assembly-view.ts"))};
import {createReference} from ${JSON.stringify(path.resolve("core/references.ts"))};
const map=new MapView(document.getElementById('map'),true,false),assembly=new AssemblyView(document.getElementById('assembly-viewport'));
window.views={map,assembly};let before;
window.prepare=(kind,axis)=>{const view=window.views[kind],camera=view.camera;view.controls.target.set(1.25,2.5,-3.75);camera.up.set(0,1,0);camera.position.copy(view.controls.target).add(new THREE.Vector3(0,9,8));camera.zoom=1.75;camera.updateProjectionMatrix();view.controls.update();view.orthographicAxis(axis);camera.updateMatrixWorld();before={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:view.controls.target.clone(),zoom:camera.zoom,distance:camera.position.distanceTo(view.controls.target)};return snapshot(kind);};
function snapshot(kind){const view=window.views[kind],camera=view.camera,delta=before.quaternion.clone().invert().multiply(camera.quaternion),a=before.position.clone().sub(before.target).normalize(),b=camera.position.clone().sub(view.controls.target).normalize();return {position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),up:camera.up.toArray(),target:view.controls.target.toArray(),zoom:camera.zoom,distance:camera.position.distanceTo(view.controls.target),targetShift:view.controls.target.distanceTo(before.target),positionShift:camera.position.distanceTo(before.position),rotation:before.quaternion.angleTo(camera.quaternion),directionAngle:a.angleTo(b),localDelta:delta.toArray()};}window.snapshot=snapshot;
window.screenBasis=kind=>{const camera=window.views[kind].camera;return {right:new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion).toArray(),up:new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion).toArray()};};
window.referenceFront=()=>{const png=document.createElement('canvas');png.width=32;png.height=64;const ctx=png.getContext('2d');ctx.fillStyle='#e5b35b';ctx.fillRect(0,0,32,64);const reference=createReference({id:'front-reference',name:'比例参考',dataUrl:png.toDataURL(),pixelWidth:32,pixelHeight:64});reference.height=2;map.reference.update(reference);map.fit({cells:[],editor:{reference}});map.orthographicAxis('top');map.orthographicAxis('front');map.draw();map.camera.updateMatrixWorld();map.reference.group.updateMatrixWorld(true);const corners=[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]].map(p=>new THREE.Vector3(...p).applyMatrix4(map.reference.mesh.matrixWorld).project(map.camera).toArray());return {corners,up:map.camera.up.toArray(),target:map.controls.target.toArray()};};
window.ready=true;
`,
);
await build({
  entryPoints: [path.join(output, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(output, "bundle.js"),
});
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(
        '<html><meta charset="utf-8"><link rel="stylesheet" href="/desktop/style.css"><link rel="stylesheet" href="/desktop/workshop-theme.css"><link rel="stylesheet" href="/desktop/workshop.css"><style>body{display:flex;margin:0}.pane{position:relative;width:600px;height:600px;flex:none}.viewport{position:absolute;inset:0}#assembly-viewport{width:600px;height:600px}</style><section class="pane"><div id="map" class="viewport"></div></section><section class="pane"><div id="assembly-viewport"></div></section><script type="module" src="/bundle.js"></script></html>',
      );
      return;
    }
    const file =
      req.url === "/bundle.js"
        ? path.join(output, "bundle.js")
        : path.resolve("." + req.url);
    res.setHeader(
      "Content-Type",
      file.endsWith(".css") ? "text/css" : "text/javascript",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1200, height: 650 },
    }),
    measurements = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForFunction(() => window.ready);
  for (const kind of ["map", "assembly"])
    for (const [dx, dy] of [
      [60, 0],
      [0, 40],
      [40, 25],
    ]) {
      let baseline;
      for (const axis of ["right", "top", "bottom", "front", "back", "left"]) {
        const initial = await page.evaluate(
            ([kind, axis]) => window.prepare(kind, axis),
            [kind, axis],
          ),
          canvas = page.locator(
            kind === "map" ? "#map canvas" : "#assembly-viewport canvas",
          ),
          box = await canvas.boundingBox();
        const basis = await page.evaluate(
            (kind) => window.screenBasis(kind),
            kind,
          ),
          expectedUp =
            axis === "top"
              ? [0, 0, -1]
              : axis === "bottom"
                ? [0, 0, 1]
                : [0, 1, 0],
          expectedRight = {
            right: [0, 0, -1],
            left: [0, 0, 1],
            front: [1, 0, 0],
            back: [-1, 0, 0],
            top: [1, 0, 0],
            bottom: [1, 0, 0],
          }[axis];
        assert.ok(
          basis.up.every((v, i) => Math.abs(v - expectedUp[i]) < 1e-6) &&
            basis.right.every((v, i) => Math.abs(v - expectedRight[i]) < 1e-6),
          `${kind} ${axis}: axis preset keeps its intended screen orientation`,
        );
        assert.ok(
          initial.target.every(
            (v, i) => Math.abs(v - [1.25, 2.5, -3.75][i]) < 1e-10,
          ),
        );
        assert.equal(initial.zoom, 1.75);
        const x = box.x + box.width * 0.55,
          y = box.y + box.height * 0.55;
        await page.mouse.move(x, y);
        await page.mouse.down({ button: "right" });
        const pressed = await page.evaluate(
          (kind) => window.snapshot(kind),
          kind,
        );
        assert.ok(
          pressed.rotation < 1e-7 && pressed.positionShift < 1e-7,
          `${kind} ${axis} beginning orbit must not jump`,
        );
        await page.mouse.move(x + dx, y + dy, { steps: 5 });
        await page.mouse.up({ button: "right" });
        const result = await page.evaluate(
          (kind) => window.snapshot(kind),
          kind,
        );
        measurements.push({ kind, axis, dx, dy, initial, result });
        await fs.writeFile(
          path.join(output, "measurements.json"),
          JSON.stringify(measurements, null, 2),
        );
        if (axis === "right") baseline = result.localDelta;
        if (dx && !dy)
          assert.ok(
            result.directionAngle > 0.5,
            `${kind} ${axis}: horizontal orbit should change viewing direction like Right view, rather than rolling at the top pole (angle ${result.directionAngle})`,
          );
        const dot = Math.abs(
            result.localDelta.reduce((n, v, i) => n + v * baseline[i], 0),
          ),
          difference = 2 * Math.acos(Math.min(1, dot));
        assert.ok(
          difference < 1e-5,
          `${kind} ${axis}: identical pointer input must keep the same local orbit frame as Right view, difference ${difference}`,
        );
        assert.ok(
          result.targetShift < 1e-8 &&
            Math.abs(result.distance - initial.distance) < 1e-7 &&
            result.zoom === initial.zoom,
          `${kind} ${axis}: orbit must retain target, distance and scale`,
        );
      }
    }
  const reference = await page.evaluate(() => window.referenceFront()),
    p = reference.corners;
  await page.waitForFunction(
    () => window.views.map.reference.mesh.material.map.image?.complete === true,
  );
  const painted = await page.evaluate(() => {
    const view = window.views.map;
    view.draw();
    const gl = view.renderer.getContext(),
      pixels = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i] > 150 && pixels[i + 1] > 80 && pixels[i + 2] < 140)
        colored++;
    return colored;
  });
  assert.ok(
    painted > 100,
    "the upright Front reference must render its decoded PNG colors",
  );
  assert.ok(
    Math.abs(p[0][1] - p[1][1]) < 1e-7 && Math.abs(p[0][0] - p[3][0]) < 1e-7,
    "PNG reference remains upright and square to Front after visiting Top",
  );
  assert.ok(
    Math.abs((p[1][0] - p[0][0]) / (p[3][1] - p[0][1]) - 0.5) < 1e-7,
    "Front preserves the PNG reference aspect ratio",
  );
  assert.deepEqual(reference.up, [0, 1, 0]);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(output, "front-reference.png") });
  await page.evaluate(() => {
    window.views.map.dispose();
    window.views.assembly.dispose();
  });
  console.log(
    JSON.stringify({ pass: true, output, cases: measurements.length }),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
