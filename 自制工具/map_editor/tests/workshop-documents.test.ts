import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plannedModule,
  fn,
  asset,
  scene,
  png,
} from "./workshop-test-support.ts";
const docs = await plannedModule("workshop-documents");
test("empty unnamed draft, scene and project survive JSON roundtrip", () => {
  for (const [make, validate, id] of [
    ["createAsset", "validateAsset", "a"],
    ["createScene", "validateScene", "s"],
    ["createProject", "validateProject", "p"],
  ]) {
    const value = fn(docs, make)(id);
    assert.deepEqual(
      fn(docs, validate)(JSON.parse(JSON.stringify(value))),
      value,
    );
  }
  const draft = fn(docs, "createAsset")("a");
  assert.equal(draft.name, "");
  assert.deepEqual(draft.cells, []);
});
test("asset validation retains reference and protection while returning isolated data", () => {
  const source = asset(),
    parsed = fn(docs, "validateAsset")(source);
  assert.deepEqual(parsed, source);
  parsed.cells[0].x = 9;
  parsed.editor.reference.x = 9;
  assert.equal(source.cells[0].x, -1);
  assert.equal(source.editor.reference.x, 0);
});
test("asset rejects invalid geometry, Root, revision and material identity", () => {
  const validate = fn(docs, "validateAsset");
  const mutations = [
    (a) => (a.schema = "bad"),
    (a) => (a.revision = 2147483648),
    (a) => (a.voxelSize = 0.5),
    (a) => a.cells.push({ ...a.cells[0] }),
    (a) => (a.cells[0].x = 0.5),
    (a) => (a.anchorM = [0.125, 0, 0]),
    (a) => (a.anchorM = [0, 0]),
    (a) => a.materialProfile.colors.pop(),
    (a) =>
      (a.materialProfile.colors[1].colorId =
        a.materialProfile.colors[0].colorId),
    (a) => (a.protectedColumns = ["999999,0"]),
    (a) => (a.editor.reference.height = 0),
    (a) => (a.instances = []),
    (a) => (a.scale = 1),
  ];
  for (const mutate of mutations) {
    const a = asset();
    mutate(a);
    assert.throws(() => validate(a));
  }
  const legacy = asset();
  legacy.rootMode = "legacy";
  legacy.anchorM = [0.125, 0, 0];
  legacy.assetId = "old.module";
  assert.doesNotThrow(() => validate(legacy));
});
test("scene validates floating assembly without Legacy terrain support", () => {
  const value = fn(docs, "validateScene")(scene());
  assert.equal(value.instances[0].positionM[2], 2);
  assert.equal("cells" in value, false);
});
test("scene keeps texture dependencies distinct from model instances", () => {
  const s = scene();
  s.assets.push({
    kind: "texture",
    assetId: "png-a",
    revision: 0,
    image: "textures/png-a.png",
  });
  s.decals.push({
    decalId: "d-a",
    assetId: "png-a",
    positionM: [0, 0, 4],
    rotationDeg: 0,
    widthM: 2,
    heightM: 1,
  });
  assert.equal(fn(docs, "validateScene")(s).decals.length, 1);
});
test("scene rejects duplicate identities, unknown groups, transforms and unsafe paths", () => {
  const validate = fn(docs, "validateScene");
  const mutations = [
    (s) => s.instances.push({ ...s.instances[0] }),
    (s) => s.groups.push({ ...s.groups[0] }),
    (s) => (s.instances[0].groupId = "absent"),
    (s) => (s.instances[0].rotationDeg = 45),
    (s) => (s.instances[0].scale = 2),
    (s) => (s.instances[0].positionM = [0, 0, Infinity]),
    (s) => (s.assets[0].source = "../other/asset.json"),
    (s) => (s.assets[0].source = "C:/outside.json"),
    (s) => (s.assets[0].source = "assets/file.json:stream"),
    (s) => (s.assets[0].source = "assets\\file.json"),
    (s) => (s.cells = []),
  ];
  for (const mutate of mutations) {
    const s = scene();
    mutate(s);
    assert.throws(() => validate(s));
  }
});
test("project refuses scene directory escape and duplicate scene registrations", () => {
  const validate = fn(docs, "validateProject");
  const p = fn(docs, "createProject")("p");
  p.scenes = [
    { sceneId: "s", name: "", source: "scenes/s/scene.xhscene.json" },
  ];
  assert.doesNotThrow(() => validate(p));
  p.scenes.push({ ...p.scenes[0] });
  assert.throws(() => validate(p));
  p.scenes.pop();
  p.scenes[0].source = "scenes/other/scene.xhscene.json";
  assert.throws(() => validate(p));
});
test("reference checks report missing data without making the source unopenable", () => {
  const s = scene();
  assert.doesNotThrow(() => fn(docs, "validateScene")(s));
  const issues = fn(docs, "checkSceneReferences")(s, new Map());
  assert.deepEqual(
    issues.map((x) => x.code),
    ["missing-asset"],
  );
  assert.equal(issues[0].documentId, "scene-a");
});
test("reference checks distinguish identity, kind and voxel phase errors", () => {
  const check = fn(docs, "checkSceneReferences"),
    s = scene(),
    a = asset();
  a.assetId = "wrong";
  assert.ok(
    check(s, new Map([["library-a", { kind: "voxel", document: a }]])).some(
      (x) => x.code === "identity-mismatch",
    ),
  );
  assert.ok(
    check(
      s,
      new Map([
        ["library-a", { kind: "texture", revision: 0, png: new Uint8Array() }],
      ]),
    ).some((x) => x.code === "kind-mismatch"),
  );
  a.assetId = "library-a";
  a.rootMode = "legacy";
  a.anchorM = [0.125, 0, 0];
  assert.ok(
    check(s, new Map([["library-a", { kind: "voxel", document: a }]])).some(
      (x) => x.code === "voxel-misaligned",
    ),
  );
  s.instances[0].positionM = [0, 0.125, 0];
  assert.deepEqual(
    check(s, new Map([["library-a", { kind: "voxel", document: a }]])),
    [],
  );
});
test("external and texture payload checks reject stale revision and damaged bytes", () => {
  const s = scene();
  s.assets = [
    {
      kind: "external",
      assetId: "model-a",
      revision: 2,
      model: "external/model-a/a.glb",
      files: ["external/model-a/a.glb"],
      anchorM: [0, 0, 0],
      recipe: "glb-rh-y-up",
    },
    {
      kind: "texture",
      assetId: "png-a",
      revision: 1,
      image: "textures/png-a.png",
    },
  ];
  s.instances[0].assetId = "model-a";
  s.decals = [
    {
      decalId: "d-a",
      assetId: "png-a",
      positionM: [0, 0, 0],
      rotationDeg: 0,
      widthM: 1,
      heightM: 1,
    },
  ];
  const data = new Map([
    [
      "model-a",
      {
        kind: "external",
        revision: 1,
        anchorM: [0, 0, 0],
        recipe: "glb-rh-y-up",
        glb: new Uint8Array(),
        files: [],
      },
    ],
    ["png-a", { kind: "texture", revision: 1, png: new Uint8Array([1, 2, 3]) }],
  ]);
  const issues = fn(docs, "checkSceneReferences")(s, data);
  assert.ok(issues.some((x) => x.code === "revision-mismatch"));
  assert.ok(issues.some((x) => x.code === "invalid-asset"));
});
test("valid PNG dependency can resolve a decal without terrain support", () => {
  const s = scene();
  s.assets = [
    {
      kind: "texture",
      assetId: "png-a",
      revision: 1,
      image: "textures/png-a.png",
    },
  ];
  s.instances = [];
  s.decals = [
    {
      decalId: "d-a",
      assetId: "png-a",
      positionM: [0, 0, 9],
      rotationDeg: 90,
      widthM: 1,
      heightM: 1,
    },
  ];
  const bytes = Uint8Array.from(atob(png.slice(22)), (c) => c.charCodeAt(0));
  assert.deepEqual(
    fn(docs, "checkSceneReferences")(
      s,
      new Map([["png-a", { kind: "texture", revision: 1, png: bytes }]]),
    ),
    [],
  );
});
test("asset validator rejects sparse palette slots instead of accepting unaddressable colors", () => {
  const a = asset();
  delete a.palette[1];
  delete a.materialProfile.colors[1];
  assert.throws(() => fn(docs, "validateAsset")(a));
});
