import type {Card,GameState,CommandResult} from './types';
import {ECONOMY,canTrade,canPay,payVitality,credit} from './economy';
const kinds:Card['kind'][]=['heal','barricade','power','cooldown','dash'];
const names={dash:'疾行',cooldown:'余响',power:'锋芒',barricade:'铁栅',heal:'急救'};
const descriptions={dash:'选择角色，再选择合法方向位移一格',cooldown:'清除目标当前装备技能冷却',power:'目标攻击强化10秒',barricade:'放置不能封死通路的路障',heal:'恢复目标45点生命'};
export function makeCard(s:GameState,kind:Card['kind'],group:Card['group']='deck',ownerId?:string):Card{return {id:'card-'+s.nextId++,templateId:group+':'+kind,kind,group,name:group==='exclusive'?'猎人·余烬':names[kind],description:descriptions[kind],ownerId,node:s.node,sellPrice:group==='deck'?2:1};}
export function drawPrice(s:GameState){return ECONOMY.drawBase+s.economy.draws*ECONOMY.drawStep;}
export function queryDraw(s:GameState,expectedPrice?:number):CommandResult{if(!canTrade(s))return {ok:false,reason:'当前不能抽牌'};if(s.cards.length>=ECONOMY.handMax)return {ok:false,reason:'手牌已满（8张）'};const price=drawPrice(s);if(expectedPrice!==undefined&&expectedPrice!==price)return {ok:false,reason:'抽牌价格已变化'};if(!canPay(s,price))return {ok:false,reason:'随身生命力不足'};return {ok:true};}
export function drawOne(s:GameState,expectedPrice?:number):CommandResult{const r=queryDraw(s,expectedPrice);if(!r.ok)return r;payVitality(s,drawPrice(s),'draw');s.seed=(s.seed*1664525+1013904223)>>>0;s.cards.push(makeCard(s,kinds[Math.floor(s.seed/4294967296*kinds.length)]));s.economy.draws++;return {ok:true};}
export function querySell(s:GameState,id:string):CommandResult{if(!canTrade(s)||!s.cards.some(c=>c.id===id))return {ok:false,reason:'该手牌不存在或当前不能变卖'};return {ok:true};}
export function salePrice(c:Card){return c.sellPrice??(c.group==='deck'?2:1);}
export function sellCard(s:GameState,id:string):CommandResult{const r=querySell(s,id);if(!r.ok)return r;const c=s.cards.find(c=>c.id===id)!;if(!credit(s,salePrice(c),'sell',id))return {ok:false,reason:'余额超限'};s.cards=s.cards.filter(a=>a!==c);flushCards(s);return {ok:true};}
export function eventCard(s:GameState,key:string,kind:Card['kind']&('dash'|'power'),group:'scene'|'exclusive',ownerId?:string){if(s.sessionMode==='exploration')return;const e=s.economy;if(!e.active||e.cardEvents.includes(key))return;e.cardEvents.push(key);e.pending.push({key,kind,group,ownerId,node:s.node});flushCards(s);}
export function flushCards(s:GameState){const e=s.economy;const ownerAlive=(id?:string)=>!id||s.units.some(u=>u.id===id&&u.life!=='dead');s.cards=s.cards.filter(c=>ownerAlive(c.ownerId));e.pending=e.pending.filter(p=>p.group!=='scene'||p.node===s.node).filter(p=>ownerAlive(p.ownerId));while(e.pending.length&&s.cards.length<ECONOMY.handMax){const p=e.pending.shift()!;s.cards.push(makeCard(s,p.kind,p.group,p.ownerId));}}
