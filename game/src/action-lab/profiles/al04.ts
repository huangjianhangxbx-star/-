/** Build24935935 native rows/events, separate from 2026-10-07 Q1 approved projections. */
export const al04={
 source:{characterId:'小黄',displayName:null,prefab:'魔弹射手',model:'小黄',spine:'4.1.23',hp:40,speed:6,
  damage:[15,20,30],comboRetention:.5,dashDistance:2.4,dashDuration:.19,dashCd:1,ammo:4,ammoCap:7,reload:.8,idleReload:3,
  rocket:{skill:'火箭弹射',child:'火箭弹射爆炸',cd:6,cost:0,range:6,duration:.33,height:3,damage:85,lifetime:.1}},
 sample:{label:'AL04 Q1 APPROVED SAMPLE',basicRange:1.8,basicHalfAngle:1,rollInvulnerability:.13,shotDamage:32,shotSpeed:12,shotRadius:.18,shotRange:6,rocketRadius:2},
 clips:[{pose:'a1',duration:.8,events:[{at:.0119,kind:'Dash'},{at:.0333,kind:'Hit'},{at:.1333,kind:'Break'},{at:.2,kind:'End'}]},
  {pose:'a2',duration:.8,events:[{at:.0333,kind:'Dash'},{at:.0667,kind:'Hit'},{at:.1667,kind:'Break'},{at:.2667,kind:'End'}]},
  {pose:'a3',duration:1.2667,events:[{at:.1667,kind:'Dash'},{at:.1667,kind:'Hit'},{at:.3,kind:'Break'},{at:.4,kind:'End'}]}],
 shot:{pose:'r1',duration:.5333,events:[{at:.0333,kind:'Hit'},{at:.4,kind:'End'}]},
 rocket:{pose:'skill_rocketjump',duration:.9,events:[{at:.1,kind:'Hit'},{at:.4667,kind:'End'}]}
} as const;
