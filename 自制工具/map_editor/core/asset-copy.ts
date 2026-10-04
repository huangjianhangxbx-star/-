import { validateAsset, type AssetDocument } from "./workshop-documents.ts";

export function cloneAsset(
  source: AssetDocument,
  newAssetId: string,
): AssetDocument {
  const copy = validateAsset(source);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(newAssetId) || newAssetId === copy.assetId)
    throw Error("独立副本必须有新的合法资产身份");
  copy.provenance = { assetId: copy.assetId, revision: copy.revision };
  copy.assetId = newAssetId;
  copy.revision = 0;
  copy.materialProfile.paletteId = `asset:${newAssetId}`;
  if (copy.materialProfile.paletteId === source.materialProfile.paletteId)
    copy.materialProfile.paletteId = `copy:${newAssetId}`;
  copy.materialProfile.paletteRevision = 1;
  return validateAsset(copy);
}
