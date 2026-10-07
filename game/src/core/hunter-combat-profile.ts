/** AR05: native clip events plus explicitly approved AL01 M2 SAMPLE consumers. */
export const HUNTER_V2={id:'hunter-v2',speed:4,inputTTL:.25,comboTTL:.625,
 stages:[
  {id:'A1',presentationId:'a1',dashAt:0,releaseAt:.0333,attackReadyAt:.2,moveReadyAt:.2333,finishAt:.7333,damage:15,range:1.7,halfAngle:1,dashDistance:.16,dashDuration:.1},
  {id:'A2',presentationId:'a2',dashAt:0,releaseAt:0,attackReadyAt:.2,moveReadyAt:.2333,finishAt:.7333,damage:15,range:1.7,halfAngle:1,dashDistance:.25,dashDuration:.1},
  {id:'A3',presentationId:'a3',dashAt:.0333,releaseAt:.0333,attackReadyAt:.2667,moveReadyAt:.3,finishAt:.6333,damage:20,range:1.8,halfAngle:1,dashDistance:.8,dashDuration:.18},
  {id:'A4',presentationId:'a4',dashAt:.1,releaseAt:.1333,attackReadyAt:.5,moveReadyAt:.5,finishAt:.8333,damage:35,range:2.2,halfAngle:.48,dashDistance:1.25,dashDuration:.14},
 ],hazardLife:.1,
 dodge:{charges:2,cd:2.5,distance:2.6,duration:.14,invulnerability:.13,damage:15,range:1.8,halfAngle:.75,durationClip:.3333,readyAt:.2,pose:'skill_dashStrike'},
 guard:{frost:3,cost:1,recovery:.8,delay:2,startup:.08,halfAngle:Math.PI/3,moveScale:.35,pose:'skill_架盾2'},
 active:{charge:1,cd:8,mp:100,cost:0,retreat:1.7,retreatTime:.15,aimMax:2,releaseTime:.1667,distance:6,duration:.2,damage:75,range:1.4,halfAngle:.7,life:.24,clip:.6,preparePose:'skill_盾冲前1',releasePose:'skill_盾冲前3',chargePose:'skill_盾冲！'},
} as const;
