/** Asset names stay in presentation. Equal exported clips are explicitly pending
 * distinct long-gun art; their names do not prove different attack semantics. */
const clips:Readonly<Record<string,string>>=Object.freeze({'hunter-shot-01':'attack_01','hunter-shot-02':'attack_02'});
export const basicPresentation=(id:string|undefined)=>id?clips[id]:undefined;
