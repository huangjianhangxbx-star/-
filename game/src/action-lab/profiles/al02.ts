/** AL02 only. Source values are not claims about original final damage. */
export type LabBuild='base'|'energy'|'ice'|'axe'|'ice-axe';
export const al02={
  source:{iceId:'小蓝a4.8戳地',iceDamage:25,iceCost:1,iceDelay:.2,iceDash:.6,iceDashDuration:.14,
    columnHp:4,columnLifetime:7,burstDamage:80,axeDamage:55,axeCooldown:8,axeDelay:.12,axeLifetime:.2},
  clip:{pose:'a改戳地跳',duration:.7667,events:[{at:0,kind:'Dash'},{at:.1,kind:'Hit'},{at:.3333,kind:'Break'},{at:.4,kind:'End'}]},
  // User approved AL02 Q1 on 2026-10-07; independent of AL01 blanket SAMPLE consent.
  sample:{iceRange:1.8,iceHalfAngle:1,iceLifetime:.1,columnOffset:1.5,columnRadius:.35,
    burstRange:2,burstLifetime:.1,axeRange:2.2,axeHalfAngle:1,
    expiry:'silent',paymentRefund:false,animationEnd:'maximum-native-keyframe',feedback:'existing-recording'},
} as const;
