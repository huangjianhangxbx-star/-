import type {TrackEvent} from '../runtime/kernel';

/** Build 24935935 CR02 / CR03A facts, not measured final timings. */
export const m2Reference = {
  activeCost:0, activeCooldown:8, activeMaxCharge:1, chargeDamage:75,
  retreatDistance:1.7, retreatDuration:.15, chargeDistance:6, chargeDuration:.2,
  frostBlockCost:1, growthFrost:2, frostBaseMax:3, frostBaseRecovery:.8,
  dodgeInvulnerability:.13,
};
/** 2026-10-07 user-approved replaceable M2 SAMPLE consumer policies. */
export const m2Sample = {
  mpInitial:100, mpMax:100, frostInitial:3, frostDelay:2,
  dashMax:2, dashCooldown:2.5, dashDistance:2.6, dashDuration:.14,
  guardStartup:.08, guardHalfAngle:Math.PI/3, guardMoveScale:.35,
  dashDamage:15, dashRange:1.8, dashHalfAngle:.75,
  chargeRange:1.4, chargeHalfAngle:.7, chargeLifetime:.24,
  activeAimMax:2,
  // Q holds aim after retreat; release runs native preparation-3 then child.
  // Root native Hit pays; max timeline acts as child-creation end policy.
  rootReleaseClip:{pose:'skill_盾冲前3',duration:.1667,events:[{at:0,kind:'Dash'},{at:0,kind:'Hit'}] as TrackEvent[]},
  dashClip:{pose:'skill_dashStrike',duration:.3333,events:[{at:0,kind:'Hit'},{at:.2,kind:'Break'},{at:.2,kind:'End'}] as TrackEvent[]},
  chargeClip:{pose:'skill_盾冲！',duration:.6,events:[{at:0,kind:'Dash'},{at:0,kind:'Hit'},{at:.0667,kind:'End'},{at:.3333,kind:'End'}] as TrackEvent[]},
  guardPose:'skill_架盾2', preparePose:'skill_盾冲前1',
};
