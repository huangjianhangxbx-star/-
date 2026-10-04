const fs = require("node:fs/promises"),
  path = require("node:path"),
  { execFile } = require("node:child_process");
const { digest } = require("./files.cjs");
function abort(signal) {
  if (signal?.aborted) throw Error(signal.reason?.message ?? "FBX转换已取消");
}
async function safeFile(stage, relative) {
  require("../dist/workshop.cjs").publishPath(relative);
  const root = path.resolve(stage);
  if ((await fs.lstat(root)).isSymbolicLink())
    throw Error("转换暂存不能是链接");
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    if ((await fs.lstat(current)).isSymbolicLink())
      throw Error("FBX依赖不能是链接");
  }
  const real = await fs.realpath(current),
    rel = path.relative(await fs.realpath(root), real);
  if (path.isAbsolute(rel) || rel.startsWith("..")) throw Error("FBX依赖越界");
  return current;
}
function blenderRunner(input, output, options) {
  return new Promise((resolve, reject) => {
    abort(options.signal);
    let callbackError,
      stdout = "",
      cancelled;
    const child = execFile(
      options.blenderExecutable,
      [
        "--background",
        "--factory-startup",
        "--python-exit-code",
        "1",
        "--python",
        path.resolve(__dirname, "../scripts/glb_to_fbx.py"),
        "--",
        "--input",
        input,
        "--output",
        output,
      ],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, text) => {
        callbackError = error;
        stdout = text ?? "";
      },
    );
    const cancel = () => {
      cancelled = options.signal.reason ?? Error("FBX转换已取消");
      child.kill();
    };
    options.signal?.addEventListener("abort", cancel, { once: true });
    child.once("close", () => {
      options.signal?.removeEventListener("abort", cancel);
      if (cancelled || callbackError) {
        reject(cancelled ?? Error("Blender转换失败：" + callbackError.message));
        return;
      }
      try {
        const line = stdout
            .split(/\r?\n/)
            .find((line) => line.startsWith('{"blender"')),
          report = JSON.parse(line ?? "null");
        if (!report || report.blender !== "5.1.2")
          throw Error("FBX路线要求Blender 5.1.2，实际版本不匹配");
        resolve({ blenderVersion: report.blender });
      } catch (e) {
        reject(e);
      }
    });
  });
}
async function convertPublishFbx(staging, input, options) {
  if (input.recipe !== "glb-fbx") return structuredClone(input);
  if (
    !options ||
    typeof options.blenderExecutable !== "string" ||
    !options.blenderExecutable
  )
    throw Error("未配置Blender；可以选择GLB-only");
  const manifest = structuredClone(input),
    runner = options.runner ?? blenderRunner,
    timeoutMs = options.timeoutMs ?? 300000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000)
    throw Error("FBX转换超时设置无效");
  if (!options.runner) {
    try {
      if (!(await fs.stat(options.blenderExecutable)).isFile())
        throw Error("不存在");
    } catch {
      throw Error("Blender不可用；请选择GLB-only或配置可执行文件");
    }
  }
  const targets = [
    { glbPath: "output/target.glb", dependency: null },
    ...manifest.dependencies
      .filter((d) => d.kind === "external")
      .map((dependency) => ({ glbPath: dependency.glbPath, dependency })),
  ];
  for (const target of targets) {
    abort(options.signal);
    const inputPath = await safeFile(staging, target.glbPath),
      modelPath = target.glbPath.replace(/\.glb$/i, ".fbx");
    if (modelPath === target.glbPath) throw Error("FBX目标必须来自GLB");
    const output = path.join(path.resolve(staging), modelPath),
      controller = new AbortController(),
      relay = () =>
        controller.abort(options.signal.reason ?? Error("FBX转换已取消"));
    options.signal?.addEventListener("abort", relay, { once: true });
    const timeout = setTimeout(
      () => controller.abort(Error("FBX转换超时")),
      timeoutMs,
    );
    let report;
    try {
      report = await runner(inputPath, output, {
        blenderExecutable: options.blenderExecutable,
        signal: controller.signal,
        timeoutMs,
      });
      abort(controller.signal);
      abort(options.signal);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", relay);
    }
    const version = report?.blenderVersion ?? options.blenderVersion;
    if (version !== "5.1.2")
      throw Error("FBX转换缺少已确认的Blender 5.1.2版本");
    manifest.toolchain.blenderVersion = version;
    manifest.toolchain.fbxRecipe = "blender-fbx-5.1.2";
    const model = await fs.readFile(await safeFile(staging, modelPath));
    if (
      model.length < 27 ||
      !model.subarray(0, 23).equals(Buffer.from("Kaydara FBX Binary  \0\x1a\0"))
    )
      throw Error("转换未产生有效FBX");
    const materialsPath = modelPath.replace(/\.fbx$/i, ".xhmaterials.json"),
      materials = await fs.readFile(await safeFile(staging, materialsPath)),
      sidecar = JSON.parse(materials);
    if (
      sidecar.schema !== "xinghai-fbx-materials-1" ||
      !Array.isArray(sidecar.colors) ||
      !Array.isArray(sidecar.textureDependencies)
    )
      throw Error("FBX材质旁车无效");
    const texturePaths = [];
    for (const texture of new Set(sidecar.textureDependencies)) {
      require("../dist/workshop.cjs").publishPath(texture);
      const relative = path.posix.dirname(modelPath) + "/" + texture,
        file = await safeFile(staging, relative),
        bytes = await fs.readFile(file);
      if (file.toLowerCase().endsWith(".png")) {
        require("../dist/workshop.cjs").pngBytes(bytes);
        require("./workshop-ipc.cjs").validatePngIntegrity(bytes);
      }
      texturePaths.push(relative);
    }
    for (const color of sidecar.colors)
      if (
        color.baseColorTexturePath &&
        !sidecar.textureDependencies.includes(color.baseColorTexturePath)
      )
        throw Error("FBX材质引用缺少纹理依赖");
    for (const relative of [modelPath, materialsPath, ...texturePaths]) {
      if (
        manifest.outputFiles.some(
          (f) => f.path.toLowerCase() === relative.toLowerCase(),
        )
      )
        throw Error("转换输出身份重复");
      const bytes = await fs.readFile(await safeFile(staging, relative));
      manifest.outputFiles.push({
        path: relative,
        sha256: digest(bytes),
        byteLength: bytes.length,
      });
    }
    if (target.dependency)
      target.dependency.unity = {
        route: "fbx",
        modelPath,
        materialsPath,
        texturePaths,
        recipe: "blender-fbx-5.1.2",
      };
  }
  return manifest;
}
module.exports = { convertPublishFbx, blenderRunner };
