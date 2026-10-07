import type {TrackEvent} from '../runtime/kernel';

/** Static clip coordinates, never input-to-damage measurements. Supplemented by locally extracted a2/a3/attack in sample.ts. */
export const reference = {
  build: '24935935',
  inputLifetime: .25,
  comboRetention: .625,
  clips: {
    a1: {duration: .7333, events: [{at: 0, kind: 'Dash'}, {at: .0333, kind: 'Hit'}, {at: .2, kind: 'Break'}, {at: .2333, kind: 'End'}] as TrackEvent[]},
    a4: {duration: .8333, events: [{at: .1, kind: 'Dash'}, {at: .1333, kind: 'Hit'}, {at: .5, kind: 'Break'}, {at: .5, kind: 'End'}] as TrackEvent[]},
  },
  missing: [
    'a1–a4 实际速率、末段后摇消费者及命中形状 / 寿命',
    '僵尸转向 / 舒适距离、最终角度门和命中几何',
    '原粒子特效移植及音效 / VFX 的原作动态挂接',
  ],
} as const;

export interface Readiness {
  playerTracks: boolean;
  playerRate: boolean;
  zombieTrack: boolean;
  movement: boolean;
  hitGeometry: boolean;
  presentation: boolean;
}
export function playableReadiness(state: Readiness): {ready: boolean; missing: string[]} {
  const missing = Object.entries(state).filter(([, ready]) => !ready).map(([name]) => name);
  return {ready: missing.length === 0, missing};
}
export const readiness: Readiness = {playerTracks: true, playerRate: false, zombieTrack: true, movement: false, hitGeometry: false, presentation: true};
