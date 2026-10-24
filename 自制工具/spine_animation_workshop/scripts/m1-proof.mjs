import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openGlb } from "../src/source/glb-motion.ts";
import { readSpineTarget } from "../src/target/spine-target.ts";
import { generateClip } from "../src/transfer/sample-clip.ts";
import { appendAnimation } from "../src/output/spine43-animation.ts";

const workRoot = fileURLToPath(new URL("../../../work/SPW-01/", import.meta.url));
const sourcePath = join(workRoot, "inputs", "CesiumMan.glb");
const targetJsonPath = join(workRoot, "inputs", "rozeul", "packed", "rozeul.json");
const atlasPath = join(workRoot, "inputs", "rozeul", "packed", "rozeul.atlas");
const imagePath = join(workRoot, "inputs", "rozeul", "packed", "rozeul.png");
const proofRoot = join(workRoot, "proofs");
const spineExecutable = process.env.SPW01_SPINE_EXECUTABLE || "E:\\Spine\\Spine.com";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function checkedJoint(source, name) {
  const matches = source.joints.filter((joint) => joint.name === name);
  if (matches.length !== 1) throw new Error(`Expected one source joint named ${name}; found ${matches.length}`);
  return matches[0].path;
}

function cliInfo(path, expectedAnimationName) {
  const result = spawnSync(spineExecutable, ["-i", path], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const count = /Animations \((\d+)\)/.exec(output);
  const version = /Spine (4\.3\.\d+) Professional/.exec(output);
  const complete = result.status === 0 && /\bComplete\./.test(output) && output.includes(expectedAnimationName);
  const summary = {
    exitCode: result.status,
    complete,
    animationCount: count ? Number(count[1]) : null,
    editorVersion: version?.[1] ?? null,
    newAnimationFound: output.includes(expectedAnimationName),
  };
  if (result.error || !complete || summary.animationCount !== 111) {
    // The raw CLI output contains local license identity; do not persist it.
    throw new Error(`Spine CLI could not read generated ${path}: ${JSON.stringify(summary)} ${result.error?.message ?? ""}`);
  }
  return summary;
}

function keyframes(clip) {
  const indices = [...new Set([0, Math.floor((clip.frames.length - 1) / 2), clip.frames.length - 1])];
  return indices.map((index) => {
    const frame = clip.frames[index];
    return { seconds: frame.seconds, keys: frame.keys, diagnostics: frame.diagnostics };
  });
}

async function main() {
  const [sourceBytes, targetBytes, atlasBytes, imageBytes] = await Promise.all([
    readFile(sourcePath), readFile(targetJsonPath), readFile(atlasPath), readFile(imagePath),
  ]);
  const inputHashes = {
    glb: sha256(sourceBytes), json: sha256(targetBytes), atlas: sha256(atlasBytes), png: sha256(imageBytes),
  };
  const source = await openGlb(sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength));
  const target = readSpineTarget(targetBytes.toString("utf8"), {
    atlasText: atlasBytes.toString("utf8"), availablePageNames: ["rozeul.png"],
  });
  if (source.clips.length !== 1 || Math.abs(source.clips[0].durationSeconds - 2) > 1e-8) {
    throw new Error("M1 proof expects the verified 2-second CesiumMan clip");
  }
  if (target.summary.bones.length !== 169 || !target.summary.editorVersion.startsWith("4.3.")) {
    throw new Error("M1 proof expects the verified rozeul Spine 4.3 export");
  }

  const common = {
    schemaVersion: 1,
    source: {
      file: sourcePath, clipId: source.clips[0].id, frontAxis: "+Z", upAxis: "+Y",
      rangeSeconds: [0, 2], referenceSeconds: 0,
    },
    target: { file: targetJsonPath, skin: "default", directionId: "rozeul-Z-current" },
    view: { yawDegrees: 0, pitchDegrees: 5, mirror: false },
    anchors: {
      sourceFootPath: checkedJoint(source, "leg_joint_L_5"),
      sourceRootPath: checkedJoint(source, "Skeleton_torso_joint_1"),
      targetFootBone: "LlegIK_hips", scale: 500, offsetX: 0, offsetY: 0,
    },
    mappings: [
      { sourcePath: checkedJoint(source, "Skeleton_torso_joint_1"), sourceEndPath: checkedJoint(source, "Skeleton_torso_joint_2"), target: "body", mode: "fk-bone", side: "center" },
      { sourcePath: checkedJoint(source, "Skeleton_torso_joint_2"), sourceEndPath: checkedJoint(source, "torso_joint_3"), target: "chest", mode: "fk-bone", side: "center" },
      { sourcePath: checkedJoint(source, "leg_joint_L_5"), target: "LlegIK_hips", mode: "ik-target", side: "left" },
      { sourcePath: checkedJoint(source, "leg_joint_R_5"), target: "RlegIK_hips", mode: "ik-target", side: "right" },
    ],
    chainCorrections: [],
    rootPolicy: "in-place-ground",
    sampleHz: 30,
    output: { animationName: "workshop/cesium_rozeul_Z_full_001", directory: proofRoot, spineVersion: target.summary.editorVersion },
  };
  const shortConfig = {
    ...common,
    source: { ...common.source, rangeSeconds: [0, 0.5] },
    output: { ...common.output, animationName: "workshop/cesium_rozeul_Z_short_001" },
  };
  const fullConfig = common;
  const shortClip = generateClip(source, target.summary, shortConfig);
  const fullClip = generateClip(source, target.summary, fullConfig);
  const shortOutput = appendAnimation(target.document, shortClip);
  const fullOutput = appendAnimation(target.document, fullClip);

  await mkdir(proofRoot, { recursive: true });
  const directory = await mkdtemp(join(proofRoot, "m1-"));
  const outputs = {
    short: join(directory, "short.json"),
    full: join(directory, "full.json"),
    config: join(directory, "calibration.json"),
    summary: join(directory, "summary.json"),
  };
  await Promise.all([
    writeFile(outputs.short, shortOutput.jsonText, { flag: "wx" }),
    writeFile(outputs.full, fullOutput.jsonText, { flag: "wx" }),
    writeFile(outputs.config, JSON.stringify({ short: shortConfig, full: fullConfig }, null, 2), { flag: "wx" }),
  ]);
  const cli = {
    short: cliInfo(outputs.short, shortOutput.name),
    full: cliInfo(outputs.full, fullOutput.name),
  };
  const currentHashes = {
    glb: sha256(await readFile(sourcePath)),
    json: sha256(await readFile(targetJsonPath)),
    atlas: sha256(await readFile(atlasPath)),
    png: sha256(await readFile(imagePath)),
  };
  if (JSON.stringify(inputHashes) !== JSON.stringify(currentHashes)) {
    throw new Error("M1 proof input changed during generation; output is not validated");
  }
  const summary = {
    status: "cli-readable",
    directory,
    outputs,
    source: { name: "Khronos CesiumMan", clip: source.clips[0], jointCount: source.joints.length },
    target: { name: "rozeul", editorVersion: target.summary.editorVersion, boneCount: target.summary.bones.length, oldAnimationCount: target.summary.animations.length },
    generated: {
      short: { name: shortOutput.name, durationSeconds: shortClip.durationSeconds, frames: shortClip.frames.length, keyframes: keyframes(shortClip) },
      full: { name: fullOutput.name, durationSeconds: fullClip.durationSeconds, frames: fullClip.frames.length, keyframes: keyframes(fullClip) },
    },
    cli,
    inputHashes,
    limitation: "CLI -i confirms JSON readability only; Spine GUI Project Import, edit/save/reopen and visual quality require separate validation.",
  };
  await writeFile(outputs.summary, JSON.stringify(summary, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ directory, outputs, cli }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
