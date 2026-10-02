import { meshMap } from "../core/mesher.ts";
self.onmessage = ({ data }) => {
  const begin = performance.now();
  try {
    self.postMessage({
      revision: data.revision,
      faces: meshMap(data.doc, data.chunks ? new Set(data.chunks) : undefined),
      milliseconds: performance.now() - begin,
    });
  } catch (e: any) {
    self.postMessage({ revision: data.revision, error: e.message });
  }
};
