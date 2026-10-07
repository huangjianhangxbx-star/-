import {reference} from './reference';
import type {TrackEvent} from '../runtime/kernel';

// Extracted from the two selected 4.1.23 JSON skeletons on 2026-10-07.
// Duration here is maximum timeline time used as a SAMPLE animation-end policy.
export const blueClips = [reference.clips.a1,
  {duration:.7333, events:[{at:0,kind:'Dash'},{at:0,kind:'Hit'},{at:.2,kind:'Break'},{at:.2333,kind:'End'}] as TrackEvent[]},
  {duration:.6333, events:[{at:.0333,kind:'Dash'},{at:.0333,kind:'Hit'},{at:.2667,kind:'Break'},{at:.3,kind:'End'}] as TrackEvent[]},
  reference.clips.a4];
export const zombieClip = {duration:2, events:[{at:0,kind:'Flash'},{at:0,kind:'Lock'},{at:.5667,kind:'Dash'},{at:.5667,kind:'Hit'}] as TrackEvent[]};
/** Explicit experiment settings. No field silently becomes a production-game rule. */
export const sample = {
  label:'AL01 SAMPLE / 原资源事件轨＋实验判定',
  hp:{blue:100,zombie:110},
  // Basic attack / root skill base atk values from selected native rows; no original final-damage claim.
  damage:[15,15,20,35], zombieDamage:5,
  blueSpeed:4, zombieSpeed:1.2, zombieTurn:3,
  finalAngle:35*Math.PI/180, comfortDistance:1.3, castRange:1.8,
  ranges:[1.7,1.7,1.8,2.2], halfAngles:[1,1,1,.48],
  hazardLifetime:.1, hurtDuration:.24, knockback:.3,
  dashDistances:[.16,.25,.8,1.25], dashDurations:[.1,.1,.18,.14],
  zombieDashDistance:.7,zombieDashDuration:.2,
  finalRecovery:.18, animationRate:1, initialCdFactor:1, zombieCd:1.5,
  arenaHalfWidth:8, arenaHalfHeight:4.5, actorRadius:.25,
} as const;
