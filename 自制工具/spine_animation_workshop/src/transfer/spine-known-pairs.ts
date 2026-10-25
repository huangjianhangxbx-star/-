import type { SpineObjectMapping } from '../core/spine-contracts.ts';
// Only skeleton identities and reviewed correspondences; no assets or local file paths.
export const knownSpinePairs: {name:string;sourceFingerprint:string;targetFingerprint:string;sourceSkin:string;targetSkin:string;mappings:SpineObjectMapping[]}[] = [
  {
    "name": "rhiny → rozeul · 正面偏右（历史人工校准映射）",
    "sourceFingerprint": "fnv1a64:7726d51b50800b2f",
    "targetFingerprint": "fnv1a64:7b03d449b44d8c8a",
    "sourceSkin": "default",
    "targetSkin": "default",
    "mappings": [
      {
        "kind": "bone",
        "source": "hips4",
        "target": "flip",
        "side": "center",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips5",
        "target": "centroid",
        "side": "center",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips6",
        "target": "body",
        "side": "center",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips7",
        "target": "chest",
        "side": "center",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips14",
        "target": "[GREEN]head",
        "side": "center",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips49",
        "target": "Z/Z_Larm1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips11",
        "target": "Larm1",
        "side": "left",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips12",
        "target": "Larm2",
        "side": "left",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips13",
        "target": "Lhand",
        "side": "left",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips24",
        "target": "Lleg",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips25",
        "target": "Lleg1",
        "side": "left",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips38",
        "target": "Lleg2",
        "side": "left",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips39",
        "target": "Lfoot",
        "side": "left",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips41",
        "target": "Rleg",
        "side": "right",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips42",
        "target": "Rleg1",
        "side": "right",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips43",
        "target": "Rleg2",
        "side": "right",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips44",
        "target": "Rfoot",
        "side": "right",
        "drive": "fk-bone"
      },
      {
        "kind": "ik",
        "source": "leftfoot",
        "target": "Lleg_ik",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "ik",
        "source": "rightfoot",
        "target": "Rleg_ik",
        "side": "right",
        "drive": "direct"
      },
      {
        "kind": "slot",
        "source": "a_leftarm",
        "target": "Z-Z_Larm2",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "slot",
        "source": "a_lefthand",
        "target": "Z-Z_Lhand1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "slot",
        "source": "hand4",
        "target": "Z-Rhand1",
        "side": "right",
        "drive": "direct"
      },
      {
        "kind": "slot",
        "source": "a_leftfoot",
        "target": "Z-Lfoot1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "a_leftarm3",
        "target": "Z/Z_Larm2_1",
        "sourceSkin": "default",
        "sourceSlot": "a_leftarm",
        "targetSkin": "default",
        "targetSlot": "Z-Z_Larm2",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "a_leftarm",
        "target": "Z/Z_Larm2",
        "sourceSkin": "default",
        "sourceSlot": "a_leftarm",
        "targetSkin": "default",
        "targetSlot": "Z-Z_Larm2",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "hand5",
        "target": "Z/Z_Lhand_woquan",
        "sourceSkin": "default",
        "sourceSlot": "a_lefthand",
        "targetSkin": "default",
        "targetSlot": "Z-Z_Lhand1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "hand7",
        "target": "Z/Z_Lhand2",
        "sourceSkin": "default",
        "sourceSlot": "a_lefthand",
        "targetSkin": "default",
        "targetSlot": "Z-Z_Lhand1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "a_lefthand",
        "target": "Z/Z_Lhand1",
        "sourceSkin": "default",
        "sourceSlot": "a_lefthand",
        "targetSkin": "default",
        "targetSlot": "Z-Z_Lhand1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "hand8",
        "target": "Z/Z_Rhand_woquan",
        "sourceSkin": "default",
        "sourceSlot": "hand4",
        "targetSkin": "default",
        "targetSlot": "Z-Rhand1",
        "side": "right",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "c_foot2",
        "target": "Z/Lfoot1",
        "sourceSkin": "default",
        "sourceSlot": "a_leftfoot",
        "targetSkin": "default",
        "targetSlot": "Z-Lfoot1",
        "side": "left",
        "drive": "direct"
      },
      {
        "kind": "bone",
        "source": "hips8",
        "target": "Rarm1",
        "side": "right",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips9",
        "target": "Rarm2",
        "side": "right",
        "drive": "fk-bone"
      },
      {
        "kind": "bone",
        "source": "hips36",
        "target": "Rhand",
        "side": "right",
        "drive": "fk-bone"
      },
      {
        "kind": "ik",
        "source": "YOU IK",
        "target": "Rarm_ik",
        "side": "right",
        "drive": "direct"
      },
      {
        "kind": "attachment",
        "source": "Z_Lhand_zhang",
        "target": "Z/Z_Lhand2",
        "sourceSkin": "default",
        "sourceSlot": "a_lefthand",
        "targetSkin": "default",
        "targetSlot": "Z-Z_Lhand1",
        "side": "left",
        "drive": "direct"
      }
    ]
  }
];
