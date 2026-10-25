export function loadSpineResource(jsonPath: string, label?: string): Promise<{
  path: string;
  name: string;
  jsonPath: string;
  atlasPath: string;
  jsonText: string;
  atlasText: string;
  atlasBytes: Buffer;
  pages: { name: string; path: string; bytes: ArrayBuffer }[];
  protectedPaths: string[];
}>;

export function assertOutputSourceResource(
  payload: { sourceKind?: 'spine' | 'glb'; sourceResourceId?: string } | undefined,
  activeSourceResourceId: string | null,
): void;

export function assertOutputTargetResource(
  payload: { targetResourceId?: string } | undefined,
  activeTargetResourceId: string | null,
): void;

export function writeOutputPackage(input: {
  outputDirectory: string;
  sourceKind?: 'spine' | 'glb';
  animationName: string;
  jsonText: string;
  configText?: string;
  reportText?: string;
  target: { jsonPath: string; atlasPath: string; atlasBytes: Buffer; pages: readonly { name: string; bytes: ArrayBuffer }[] };
}): Promise<{ directory: string; jsonPath: string }>;
