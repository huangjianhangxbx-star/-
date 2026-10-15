import type {ItemDefinition} from './inventory-model';
export const COIN='trade-coin';
export const RARITIES=['gray','blue','purple','gold','redgold'] as const;
export const RARITY_NAMES={gray:'灰',blue:'蓝',purple:'紫',gold:'金',redgold:'红金'};
const foods=['烤麦饼','霜莓果酱','暖炉炖肉','星蜜酥饼','赤曜盛宴'];
const treasures=['旧银怀表','海蓝晶簇','紫辉香匣','鎏金星盘','赤金王冠'];
const bottles=['微光魔素瓶','凝蓝魔素瓶','紫晶魔素瓶','辉金魔素瓶','赤曜魔素瓶'];
/** Designer-owned SAMPLE tuning; no inferred source-game effects. */
export const ITEM_CATALOG:Record<string,ItemDefinition>={
 [COIN]:{id:COIN,name:'钱币',description:'出售物品获得的钱币，可堆叠并在背包与容器间转移。',width:1,height:1,maxStack:999999,category:'currency',unitWeightGrams:0,rarity:'gold',icon:'/assets/ui/items/trade-coin.svg'},
};
for(let tier=0;tier<5;tier++){
 const common={width:1,height:1,maxStack:20,rarity:RARITIES[tier]};
 const id=`food-${tier}`,perSecond=[2,3,5,8,12][tier],seconds=[8,10,12,15,20][tier];
 ITEM_CATALOG[id]={...common,id,name:foods[tier],description:`食用后每秒恢复${perSecond}生命，持续${seconds}秒；食物恢复不叠加。`,category:'food',unitWeightGrams:[150,200,400,250,600][tier],sellValue:[8,20,50,120,300][tier],use:{kind:'regen',perSecond,seconds},icon:`/assets/ui/items/${id}.svg`};
 const treasure=`treasure-${tier}`;ITEM_CATALOG[treasure]={...common,id:treasure,name:treasures[tier],description:'旅途中的贵重收藏，仅用于出售。',category:'treasure',unitWeightGrams:[200,300,350,500,700][tier],sellValue:[100,300,900,2700,8100][tier],icon:`/assets/ui/items/${treasure}.svg`};
 const bottle=`magic-${tier}`;ITEM_CATALOG[bottle]={...common,id:bottle,name:bottles[tier],description:'魔素容器占位物；当前不能使用，不改变魔素。',category:'magic-placeholder',unitWeightGrams:250,icon:`/assets/ui/items/${bottle}.svg`};
}
