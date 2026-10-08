// Native EventTimeline seconds, exported readonly from rozeul.spine 4.3.26.
// Unlocks are independent XX SAMPLE. hit_to_idle is recorded as recovery only.
export const XX_PROFILE={id:'xx-experiment',direction:'single-rig-horizontal-mirror',visualScale:2,
 animations:{idle:'idle1_1',move:'run',hurt:'upper_hitted_all',death:'death'},
 stages:[
  {pose:'atk1',start:.08333333,end:.2666667,recovery:.3666667,duration:1.1,damage:15,range:1.7,halfAngle:1},
  {pose:'atk2',start:.1,end:.3666667,recovery:.5,duration:1.2666667,damage:15,range:1.7,halfAngle:1},
  {pose:'atk3',start:.23333333,end:.4166667,recovery:.6833333,duration:1.3,damage:20,range:1.8,halfAngle:1},
  {pose:'atk4',start:.06666667,end:.5666666,recovery:.7666666,duration:1.4666667,damage:35,range:2.2,halfAngle:.48}
 ],sample:'XX SAMPLE FROM BLUE: damage/range/cone; unlock recovery+1/60 attack, +2/60 move; no inherited dash or specials',
} as const;
