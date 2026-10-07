/** Selected Build 24935935 definitions and original Spine event, not original OBS. */
export const al03={
 reference:{enemyId:'骷髅弓',model:'1骷髅弓',rootSkill:'骷髅弓射箭',children:['骷髅弓射箭2','骷髅弓射箭3'],
  explosionSkill:'骷髅弓射箭爆炸',spawnEventTime:.6333,transportDuration:.92,transportHeight:3.8,
  damage:3,castRange:9,minRange:1,initialCooldown:3,repeatCooldown:4.2,childInterval:.1,landingOffsets:[.4,2,2]},
 sample:{label:'AL03 SOURCE + SAMPLE',landingCount:3,explosionRadius:.8,explosionLifetime:.1,enemyHp:110,
  comfortMin:4,comfortMax:6,moveSpeed:1.2,turnSpeed:3,finalAngle:35*Math.PI/180,actionRecovery:1.2,seed:3107,
  obstaclePolicy:'clamp-landing-to-arena-and-project-from-test-block',ownerDeathPolicy:'retain' as const,
  bounce:false,contactOnlyOnLanding:true,guardCoincidenceEpsilon:.001},
} as const;
