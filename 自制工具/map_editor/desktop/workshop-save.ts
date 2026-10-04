import type {
  ProjectDocument,
  SceneDocument,
} from "../core/workshop-documents.ts";
import type { WorkshopSession } from "./workshop-session.ts";
/** Capture every participant synchronously, before acquiring leases or invoking IPC. */
export function captureWorkshopSave(
  project: ProjectDocument,
  entries: Iterable<SceneDocument>,
  manager: WorkshopSession,
) {
  const writes: { path: string; kind: string; id: string; document: any }[] = [
    {
      path: "project.xhproject.json",
      kind: "project",
      id: project.projectId,
      document: structuredClone(project),
    },
  ];
  const assets: { sessionId: string; revision: number; file: string }[] = [],
    scenes: { sceneId: string; revision: number }[] = [];
  for (const entry of entries) {
    const scene = manager.sceneSession(entry.sceneId).snapshot();
    scenes.push({ sceneId: scene.sceneId, revision: scene.revision });
    writes.push({
      path: `scenes/${scene.sceneId}/scene.xhscene.json`,
      kind: "scene",
      id: scene.sceneId,
      document: scene,
    });
    for (const row of scene.assets)
      if (row.kind === "voxel") {
        let session;
        try {
          session = manager.assetSession(row.assetId);
        } catch {
          continue;
        }
        const document = structuredClone(manager.sync(session.sessionId)),
          file = `scenes/${scene.sceneId}/${row.source}`;
        writes.push({ path: file, kind: "asset", id: row.assetId, document });
        assets.push({
          sessionId: session.sessionId,
          revision: document.revision,
          file,
        });
      }
  }
  return { writes, assets, scenes };
}
