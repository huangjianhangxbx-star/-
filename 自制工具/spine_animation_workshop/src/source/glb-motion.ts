import { AnimationMixer, LoopOnce, Matrix4, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { JointPose, MotionSource } from '../core/contracts.ts';

type GlbNode = { name?: string; [key: string]: unknown };
type GlbSkin = { joints: number[]; inverseBindMatrices?: number };
type GlbDocument = {
  nodes?: GlbNode[];
  skins?: GlbSkin[];
  animations?: { name?: string }[];
  [key: string]: unknown;
};

const JSON_CHUNK = 0x4e4f534a;

function motionOnlyGlb(bytes: ArrayBuffer): { data: ArrayBuffer; document: GlbDocument } {
  if (bytes.byteLength < 20) throw new Error('Invalid GLB: header is incomplete');
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('Invalid GLB: expected glTF binary version 2');
  }
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error('Invalid GLB: length does not match input');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + jsonLength > bytes.byteLength) {
    throw new Error('Invalid GLB: JSON chunk is missing or truncated');
  }
  const document = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength))) as GlbDocument;
  if (!Array.isArray(document.nodes) || !Array.isArray(document.skins)) {
    throw new Error('GLB has no skeleton nodes or skins');
  }
  if (!Array.isArray(document.animations) || document.animations.length === 0) {
    throw new Error('GLB has no animation clips');
  }

  // GLTFLoader only needs nodes, skin metadata, accessors, buffers and animations here.
  // Strip visual resources in a fresh document so motion loading works offline in Node
  // without DOM image decoders. The caller's GLB bytes are never changed.
  const motionDocument: GlbDocument = {
    ...document,
    nodes: document.nodes.map((node) => {
      const motionNode = { ...node };
      delete motionNode.mesh;
      delete motionNode.skin;
      delete motionNode.camera;
      delete motionNode.extensions;
      return motionNode;
    }),
  };
  for (const key of ['meshes', 'materials', 'textures', 'images', 'samplers', 'cameras', 'extensions', 'extensionsUsed', 'extensionsRequired']) {
    delete motionDocument[key];
  }
  const json = new TextEncoder().encode(JSON.stringify(motionDocument));
  const paddedJsonLength = Math.ceil(json.byteLength / 4) * 4;
  const remainingOffset = 20 + jsonLength;
  const remainingLength = bytes.byteLength - remainingOffset;
  const output = new ArrayBuffer(20 + paddedJsonLength + remainingLength);
  const outputView = new DataView(output);
  outputView.setUint32(0, 0x46546c67, true);
  outputView.setUint32(4, 2, true);
  outputView.setUint32(8, output.byteLength, true);
  outputView.setUint32(12, paddedJsonLength, true);
  outputView.setUint32(16, JSON_CHUNK, true);
  new Uint8Array(output, 20, paddedJsonLength).fill(0x20);
  new Uint8Array(output, 20, json.byteLength).set(json);
  new Uint8Array(output, 20 + paddedJsonLength).set(new Uint8Array(bytes, remainingOffset));
  return { data: output, document };
}

function pathSegment(name: string | undefined, index: number): string {
  return (name || `@${index}`).replaceAll('~', '~0').replaceAll('/', '~1');
}

export async function openGlb(bytes: ArrayBuffer): Promise<MotionSource> {
  const { data, document } = motionOnlyGlb(bytes);
  const gltf = await new GLTFLoader().parseAsync(data, '');
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  const nodeObjects = new Map<number, Object3D>();
  const nodePaths = new Map<number, string>();
  const paths = new Set<string>();
  const associations = gltf.parser.associations as Map<Object3D, { nodes?: number }>;
  function visit(object: Object3D, parentPath: string): void {
    const index = associations.get(object)?.nodes;
    let path = parentPath;
    if (index !== undefined) {
      path = `${parentPath}/${pathSegment(document.nodes![index]?.name, index)}`;
      if (paths.has(path)) throw new Error(`Duplicate GLB node path: ${path}`);
      paths.add(path);
      nodeObjects.set(index, object);
      nodePaths.set(index, path);
    }
    for (const child of object.children) visit(child, path);
  }
  visit(scene, '');

  const jointIds = [...new Set(document.skins!.flatMap((skin) => skin.joints))];
  if (jointIds.length === 0) throw new Error('GLB skeleton has no joints');
  const jointIdSet = new Set(jointIds);
  const bindWorld = new Map<number, readonly number[]>();
  for (const id of jointIds) {
    const object = nodeObjects.get(id);
    if (!object) throw new Error(`GLB joint ${id} is not in the active scene`);
    bindWorld.set(id, object.matrixWorld.toArray());
  }
  for (let skinIndex = 0; skinIndex < document.skins!.length; skinIndex++) {
    const skin = document.skins![skinIndex];
    if (skin.inverseBindMatrices === undefined) continue;
    const loadedSkin = await gltf.parser.getDependency('skin', skinIndex);
    for (let index = 0; index < skin.joints.length; index++) {
      const inverse = loadedSkin.boneInverses[index] as Matrix4;
      if (!inverse) throw new Error(`GLB skin ${skinIndex} has an incomplete bind pose`);
      bindWorld.set(skin.joints[index], inverse.clone().invert().toArray());
    }
  }

  const joints = jointIds.map((id) => {
    const object = nodeObjects.get(id)!;
    let parent = object.parent;
    while (parent && associations.get(parent)?.nodes === undefined) parent = parent.parent;
    while (parent && !jointIdSet.has(associations.get(parent)?.nodes ?? -1)) {
      parent = parent.parent;
    }
    const parentIndex = parent ? associations.get(parent)?.nodes : undefined;
    return {
      path: nodePaths.get(id)!,
      parentPath: parentIndex === undefined ? null : nodePaths.get(parentIndex)!,
      name: document.nodes![id]?.name || `Node ${id}`,
    };
  });

  const defaults = [...nodeObjects.values()].map((object) => ({
    object,
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
  }));
  const mixer = new AnimationMixer(scene);
  const clips = gltf.animations.map((clip, index) => ({
    id: `clip:${index}`,
    name: document.animations![index]?.name || clip.name || `Animation ${index + 1}`,
    durationSeconds: clip.duration,
  }));
  const actions = gltf.animations.map((clip) => {
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 0);
    action.clampWhenFinished = true;
    return action;
  });

  return {
    joints,
    clips,
    poseAt(clipId, seconds): readonly JointPose[] {
      const clipIndex = clips.findIndex((clip) => clip.id === clipId);
      if (clipIndex < 0) throw new Error(`Unknown animation clip: ${clipId}`);
      const duration = clips[clipIndex].durationSeconds;
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) {
        throw new Error(`Sample time ${seconds} is outside clip range 0–${duration}`);
      }
      mixer.stopAllAction();
      for (const item of defaults) {
        item.object.position.copy(item.position);
        item.object.quaternion.copy(item.quaternion);
        item.object.scale.copy(item.scale);
      }
      actions[clipIndex].reset().play();
      mixer.setTime(seconds);
      scene.updateMatrixWorld(true);
      return jointIds.map((id, index) => ({
        path: joints[index].path,
        parentPath: joints[index].parentPath,
        world: nodeObjects.get(id)!.matrixWorld.toArray(),
        bindWorld: [...bindWorld.get(id)!],
      }));
    },
  };
}
