import { describe, it, expect } from "vitest";
import { createGame, command, step, cloneTiles } from "../src/core/engine";

function prepared(vitality = 0) {
  const s = createGame("workbench");
  expect(command(s, { type: "carry", gold: 0, vitality }).ok).toBe(true);
  expect(command(s, { type: "start" }).ok).toBe(true);
  return s;
}
function advance(s: ReturnType<typeof prepared>, seconds: number) {
  for (let i = 0; i < seconds * 20 && s.phase === "battle"; i++) step(s, 0.05);
}

describe("editable map tower flow", () => {
  it("keeps hunter movement and blink usable on the derived terrain", () => {
    const s = prepared();
    const hunter = s.units.find(u => u.id === "hunter")!;
    const charges = hunter.blink!.charges;
    const directions = [
      { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 },
    ];
    const blinkResult = directions.map(direction => command(s, { type: "blink", id: "hunter", direction }))
      .find(result => result.ok);
    expect(blinkResult?.ok).toBe(true);
    expect(hunter.blink!.charges).toBe(charges - 1);
    const moveResult = command(s, { type: "move", id: "hunter", to: { x: 2, y: 2 } });
    expect(moveResult.ok, moveResult.reason).toBe(true);
    advance(s, 12);
    expect(hunter.pos.x).toBeCloseTo(2);
    expect(hunter.pos.y).toBeCloseTo(2);
  });
  it("spends carried vitality on training, cards and a clone during a normal three-wave clear", () => {
    const s = createGame("workbench");
    s.economy.account = { gold: 25, vitality: 100 };
    const act = (c: Parameters<typeof command>[1]) => {
      const result = command(s, c);
      expect(result.ok, `${c.type}: ${result.reason}`).toBe(true);
    };
    act({ type: "carry", gold: 5, vitality: 80 });
    act({ type: "upgradeSkill", id: "ines", kind: "stage", expectedLevel: 0 });
    act({ type: "draw", expectedPrice: 10 });
    const drawn = s.cards.find(c => c.group === "deck");
    expect(drawn).toBeDefined();
    act({ type: "sellCard", cardId: drawn!.id });
    act({ type: "start" });
    advance(s, 10);
    for (const [id, to] of [
      ["fiorre", { x: 5, y: 6 }], ["ines", { x: 6, y: 7 }],
      ["ranger", { x: 8, y: 7 }],
    ] as const) act({ type: "deploy", id, to, facing: "east" });
    const cloneAt = cloneTiles(s, "ines").find(p => p.x >= 7 && p.x <= 10 && p.y >= 5 && p.y <= 8);
    expect(cloneAt).toBeDefined();
    act({ type: "clone", id: "ines", to: cloneAt! });
    act({ type: "skill", id: "ranger" });
    advance(s, 280);
    expect(s.result).toBe("victory");
    expect(s.wave).toBe(3);
    expect(s.economy.account.gold).toBe(20);
    expect(s.economy.rewards.length).toBe(new Set(s.economy.rewards).size);
  });
  it("plays all three waves with normal deployment and earns each kill reward once", () => {
    const s = prepared();
    advance(s, 10);
    for (const [id, to] of [
      ["fiorre", { x: 5, y: 6 }], ["ines", { x: 6, y: 7 }],
      ["ranger", { x: 8, y: 7 }],
    ] as const) {
      const result = command(s, { type: "deploy", id, to, facing: "east" });
      expect(result.ok, `${id}: ${result.reason}`).toBe(true);
    }
    advance(s, 280);
    expect(s.result).toBe("victory");
    expect(s.wave).toBe(3);
    expect(s.spawned).toBe(s.totalEnemies);
    expect(new Set(s.economy.rewards).size).toBe(s.economy.rewards.length);
  });
  it("naturally reaches defeat when the two routes are left undefended", () => {
    const s = prepared();
    const moved = command(s, { type: "move", id: "hunter", to: { x: 2, y: 2 } });
    expect(moved.ok, moved.reason).toBe(true);
    advance(s, 280);
    expect(s.spawned).toBeGreaterThan(0);
    expect(s.result).toBe("defeat");
    expect(s.endReason).toBe("crystal");
    expect(command(s, { type: "continue" }).ok).toBe(true);
    expect(command(s, { type: "enter", node: 1 }).ok).toBe(true);
    expect(s.mode).toBe("workbench");
    expect(s.width).toBe(24);
    expect(command(s, { type: "start" }).ok).toBe(true);
    advance(s, 280);
    expect(s.result).toBe("victory");
    expect(new Set(s.economy.rewards).size).toBe(s.economy.rewards.length);
  });
});
