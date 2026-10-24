export function writeOutputPackage(input: {
  outputDirectory: string;
  animationName: string;
  jsonText: string;
  configText?: string;
  target: { jsonPath: string; atlasPath: string; pages: readonly { name: string; path: string }[] };
}): Promise<{ directory: string; jsonPath: string }>;
