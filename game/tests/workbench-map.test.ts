import { describe, it, expect } from "vitest";
import { getWorkbenchSample } from "../src/core/workbench-map";
import { createGame, command } from "../src/core/engine";

describe("map workbench tower validation", () => {
  it("derives two passable routes, highgrounds, spawn markers and crystal from editable voxels", () => {
    const sample = getWorkbenchSample();
    expect(sample.source.voxelSize).toBe(0.25);
    expect(sample.width).toBe(24);
    expect(sample.height).toBe(14);
    expect(sample.spawns).toHaveLength(2);
    expect(sample.routes).toHaveLength(2);
    expect(sample.routes[0].at(-1)).toEqual(sample.goal);
    expect(sample.routes[1].at(-1)).toEqual(sample.goal);
    expect(sample.tiles.filter(t => t.layer === 1).length).toBeGreaterThan(5);
    expect(sample.routes.flat().every(p => !sample.tiles[p.y * sample.width + p.x].obstacle)).toBe(true);
    expect(sample.source.cells.length).toBeGreaterThan(5000);
  });
  it("opens an independent three-wave map through normal carry and battle flow", () => {
    const s = createGame("workbench");
    expect(command(s, { type: "carry", gold: 0, vitality: 0 }).ok).toBe(true);
    expect(s.width).toBe(24);
    expect(s.waves).toHaveLength(3);
    expect(command(s, { type: "start" }).ok).toBe(true);
    expect(s.phase).toBe("battle");
  });
});
