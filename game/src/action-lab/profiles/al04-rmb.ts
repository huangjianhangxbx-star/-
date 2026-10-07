/** RQ02 Build24935935: Cannonball 炮弹 -> 小黄远程 -> 铁弹子弹.
 * Static consumers establish one paid response / one round, not an observed run.
 */
export const ironRound={ammoId:'炮弹',skillId:'小黄远程',bulletId:'铁弹子弹',pose:'r1',damage:32,speed:30,range:5.6,
 radius:.18, // AL04 Q1 collision SAMPLE retained; native collider has not been measured.
 duration:.5333,events:[{at:.0333,kind:'Hit'},{at:.4,kind:'End'}]} as const;
