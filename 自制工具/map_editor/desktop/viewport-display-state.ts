export type ViewportId = "edit" | "preview" | "assembly" | "rock-lab";
export type DisplayPreset =
  | "studio-gray"
  | "albedo"
  | "studio-color"
  | "raking-gray";
export type CavityLevel = "off" | "low" | "medium";
export interface DisplayState {
  preset: DisplayPreset;
  rotation: number;
  followCamera: boolean;
  brightness: number;
  cavity: CavityLevel;
  background: "dark" | "mid" | "light";
  structureEdges: boolean;
  voxelLines: boolean;
  grid: boolean;
}
export const presetNames: Record<DisplayPreset, string> = {
  "studio-gray": "清晰灰模",
  albedo: "原色检查",
  "studio-color": "材质柔光",
  "raking-gray": "结构侧光",
};
export const preferenceKey = "xinghai.viewport-display.v1";
export function displayDefaults(
  view: ViewportId,
  preset?: DisplayPreset,
): DisplayState {
  preset ??=
    view === "edit" || view === "rock-lab" ? "studio-gray" : "studio-color";
  return {
    preset,
    rotation: 0,
    followCamera: preset !== "raking-gray",
    brightness: 1,
    cavity:
      preset === "albedo" ? "off" : preset === "raking-gray" ? "medium" : "low",
    background: "dark",
    structureEdges: false,
    voxelLines: false,
    grid: true,
  };
}
export function normalizeDisplay(input: any, view: ViewportId): DisplayState {
  const preset: DisplayPreset =
    input && Object.hasOwn(presetNames, input.preset)
      ? input.preset
      : displayDefaults(view).preset;
  const d = displayDefaults(view, preset),
    value = input && typeof input === "object" ? input : {};
  const number = (key: "rotation" | "brightness", min: number, max: number) =>
    typeof value[key] === "number" && Number.isFinite(value[key])
      ? Math.min(max, Math.max(min, value[key]))
      : d[key];
  const bool = (
    key: "followCamera" | "structureEdges" | "voxelLines" | "grid",
  ) => (typeof value[key] === "boolean" ? value[key] : d[key]);
  return {
    preset,
    rotation: number("rotation", 0, 360),
    brightness: number("brightness", 0.25, 2),
    followCamera: bool("followCamera"),
    structureEdges: bool("structureEdges"),
    voxelLines: bool("voxelLines"),
    grid: bool("grid"),
    cavity: ["off", "low", "medium"].includes(value.cavity)
      ? value.cavity
      : d.cavity,
    background: ["dark", "mid", "light"].includes(value.background)
      ? value.background
      : d.background,
  };
}
export function effectiveDisplay(state: DisplayState): DisplayState {
  return state.preset === "albedo"
    ? { ...state, brightness: 1, cavity: "off" }
    : state;
}
export function readDisplayPreferences(raw: string | null) {
  let data: any;
  try {
    data = JSON.parse(raw ?? "null");
  } catch {}
  if (data?.version !== 1) data = {};
  return {
    version: 1,
    sync: data.sync === true,
    views: Object.fromEntries(
      (["edit", "preview", "assembly", "rock-lab"] as ViewportId[]).map(
        (id) => [id, normalizeDisplay(data.views?.[id], id)],
      ),
    ) as Record<ViewportId, DisplayState>,
  };
}
