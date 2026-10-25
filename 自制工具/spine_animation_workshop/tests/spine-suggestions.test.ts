import assert from "node:assert/strict";
import { test } from "node:test";
import type { SpineObjectMapping, SpineChannelPolicy } from "../src/core/spine-contracts.ts";
import { analyzeSpineMapping, suggestSpineMappings } from "../src/transfer/spine-suggestions.ts";

function pair() {
  const source = {
    skeleton: { spine: "4.3.26" },
    bones: [{ name: "root" }, { name: "Larm", parent: "root", rotation: 8 }, { name: "Rarm", parent: "root" }],
    slots: [{ name: "hand", bone: "Larm", attachment: "open" }],
    skins: [{ name: "default", attachments: { hand: { open: {}, closed: {} } } }],
    animations: { wave: {
      bones: { Larm: { rotate: [{ value: 0 }, { time: 1, value: 50 }] }, Rarm: { rotate: [{ value: 20 }] } },
      slots: { hand: { attachment: [{ name: "closed" }] } },
    } },
  };
  const target = {
    skeleton: { spine: "4.3.26" },
    bones: [{ name: "root" }, { name: "Larm", parent: "root", rotation: 10 }, { name: "Rarm", parent: "root" }],
    slots: [{ name: "hand", bone: "Larm", attachment: "open" }],
    skins: [{ name: "default", attachments: { hand: { open: {}, closed: {} } } }],
    animations: {},
  };
  return { source, target };
}

const map = (kind: SpineObjectMapping["kind"], source: string, target: string): SpineObjectMapping =>
  ({ kind, source, target, side: "unknown", drive: "direct" }) as SpineObjectMapping;

test("suggests only unique exact keyed objects, with ambiguity and side/type checks", () => {
  const { source, target } = pair();
  const suggestions = suggestSpineMappings(source, target, "wave");
  assert.equal(suggestions.find((item) => item.kind === "bone" && item.source === "Larm")?.status, "exact");
  assert.equal(suggestions.find((item) => item.kind === "slot" && item.source === "hand")?.status, "exact");
  assert.equal(suggestions.filter((item) => item.kind === "bone").length, 2);

  target.bones[1]!.name = "larm";
  target.bones.push({ name: "LARM", parent: "root", rotation: 0 });
  const ambiguous = suggestSpineMappings(source, target, "wave");
  const arm = ambiguous.find((item) => item.kind === "bone" && item.source === "Larm");
  assert.equal(arm?.status, "ambiguous");
  assert.equal(arm?.target, undefined);

  target.bones[1]!.name = "direction/Larm";
  target.bones.pop();
  const prefixed = suggestSpineMappings(source, target, "wave");
  assert.equal(prefixed.find((item) => item.kind === "bone" && item.source === "Larm")?.status, "ambiguous");
});

test("analyzer reports every actually keyed channel and does not hide unmapped controls", () => {
  const { source, target } = pair();
  const mappings = [map("bone", "Larm", "Larm")];
  const report = analyzeSpineMapping(source, target, "wave", mappings);
  assert.equal(report.channels.length, 3);
  assert.equal(report.channels.find((item) => item.source === "Larm")?.status, "direct");
  assert.equal(report.channels.find((item) => item.source === "Rarm")?.status, "unmapped");
  assert.equal(report.channels.find((item) => item.kind === "slot")?.status, "unmapped");
  assert.equal(report.blocked, true);
  const policies: SpineChannelPolicy[] = [
    { kind: "bone", source: "Rarm", channel: "rotate", decision: "skip", reason: "Decorative opposite arm" },
    { kind: "slot", source: "hand", channel: "attachment", decision: "skip", reason: "Display kept on target" },
  ];
  const explicit = analyzeSpineMapping(source, target, "wave", mappings, policies);
  assert.equal(explicit.blocked, false);
  assert.equal(explicit.totals.explicitSkip, 2);
});

test("duplicate target property and cross-side mapping become conflicts", () => {
  const { source, target } = pair();
  const duplicate = analyzeSpineMapping(source, target, "wave", [
    map("bone", "Larm", "Larm"), map("bone", "Rarm", "Larm"),
  ]);
  assert.equal(duplicate.channels.filter((item) => item.kind === "bone" && item.status === "conflict").length, 2);
  const crossed = analyzeSpineMapping(source, target, "wave", [
    { kind: "bone", source: "Larm", target: "Rarm", side: "left", drive: "direct" },
  ]);
  assert.equal(crossed.channels.find((item) => item.source === "Larm")?.status, "conflict");
  target.bones.push({ name: "Z/Z_Rarm1", parent: "root", rotation: 0 });
  const prefixedCrossed = analyzeSpineMapping(source, target, "wave", [
    { kind: "bone", source: "Larm", target: "Z/Z_Rarm1", side: "left", drive: "direct" },
  ]);
  assert.equal(prefixedCrossed.channels.find((item) => item.source === "Larm")?.status, "conflict");
});

test("an active target IK chain blocks FK keys even without an IK mapping", () => {
  const { source, target } = pair();
  (target as any).constraints = [{ type: "ik", name: "armIK", bones: ["Larm"], target: "root", mix: 1 }];
  const report = analyzeSpineMapping(source, target, "wave", [map("bone", "Larm", "Larm")], [
    { kind: "bone", source: "Rarm", channel: "rotate", decision: "skip", reason: "Other arm" },
    { kind: "slot", source: "hand", channel: "attachment", decision: "skip", reason: "Target display" },
  ]);
  assert.equal(report.channels.find((item) => item.source === "Larm")?.status, "conflict");
  assert.match(report.channels.find((item) => item.source === "Larm")?.reason ?? "", /IK/i);
});
