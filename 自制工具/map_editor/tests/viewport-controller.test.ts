import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ViewportDisplayController } from "../desktop/viewport-display-controller.ts";
test("display state cannot commit mid-gesture and paint transitions respect explicit overrides", () => {
  let busy = false;
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera();
  const position = camera.position.toArray();
  const controller = new ViewportDisplayController({
    renderer: {} as T.WebGLRenderer,
    scene,
    camera,
    host: {} as HTMLElement,
    id: "edit",
    target: () => new T.Vector3(),
    busy: () => busy,
    persist: false,
  });
  controller.paintMode(true);
  assert.equal(controller.state.preset, "albedo");
  controller.paintMode(false);
  assert.equal(controller.state.preset, "studio-gray");
  controller.paintMode(true);
  controller.set({ preset: "studio-color" });
  controller.paintMode(false);
  assert.equal(controller.state.preset, "studio-color");
  busy = true;
  assert.equal(controller.set({ preset: "raking-gray" }), false);
  assert.equal(controller.state.preset, "studio-color");
  busy = false;
  controller.set({ preset: "raking-gray" });
  assert.equal(controller.state.followCamera, false);
  assert.deepEqual(camera.position.toArray(), position);
  controller.dispose();
  assert.equal(scene.children.length, 0);
});
