'use strict';
const TEMPLATES = Object.freeze([
  {id:'XH-STONE-FLOOR-8COND-01',version:'0.1.0',label:'平面石砖联通',status:'candidate',kind:'stone-floor',material:'stone',sourceFamily:null,sourceField:null,source:'原创候选：正交俯视铺地，无前立面；条件八邻47态，非原作复刻'},
  {id:'XH-GRASS-8COND-01',version:'0.1.0',label:'草地连续边缘',status:'candidate',kind:'grass',material:'vegetation',sourceFamily:'f8c707f41a2653',sourceField:'.tileGrassContinued',source:'384×384 / 384 PPU / pivot .5,.5；底图层级未实机确认'},
  {id:'XH-STONE-EDGE-8COND-01',version:'0.1.0',label:'石质边缘与厚度',status:'candidate',kind:'stone',material:'stone',sourceFamily:'dee2d10a1b13fc',sourceField:'.tileStones[0]',source:'384–448×384–576 / 384 PPU；多 pivot；厚度/层级仅候选，非原作复刻'},
]);
const DIRECTIONS=[[-1,-1,1],[0,-1,2],[1,-1,4],[-1,0,8],[1,0,16],[-1,1,32],[0,1,64],[1,1,128]];
function normalizeMask(mask){
  if(!Number.isInteger(mask)||mask<0||mask>255)throw Error('邻接 mask 必须在 0–255 内');
  for(const [diagonal,a,b] of [[1,2,8],[4,2,16],[32,64,8],[128,64,16]])if(!(mask&a)||!(mask&b))mask&=~diagonal;
  return mask;
}
const MASKS=Object.freeze(Array.from({length:256},(_,i)=>i).filter(i=>normalizeMask(i)===i));
function maskAt(board,x,y){return normalizeMask(DIRECTIONS.reduce((m,[dx,dy,bit])=>m|(board[y+dy]?.[x+dx]?bit:0),0));}
function randomBoard(size,seed){let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};return Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>x>0&&y>0&&x<size-1&&y<size-1&&rand()<(.3+.5*x/size)?1:0));}
function continuousBoard(){
  // A 28-cell diagnostic canvas is 66% smaller than the earlier 48-cell canvas.
  // Select real neighborhoods in a coherent occupancy field, not an atlas of 47 drawings.
  for(let seed=1;seed<=4000;seed++){
    const board=randomBoard(28,seed),found=new Map();
    board.forEach((row,y)=>row.forEach((v,x)=>{if(v&&!found.has(maskAt(board,x,y)))found.set(maskAt(board,x,y),{x,y});}));
    if(found.size===47)return {board,found,seed};
  }
  throw Error('无法构造完整连续母版');
}
let continuous;
function makeGrammar({templateId='XH-GRASS-8COND-01',cellPixels=128,ppu=100,strategy='layered',masterPixels}={}){
  const template=TEMPLATES.find(t=>t.id===templateId);
  if(!template)throw Error('未知特化模板');
  if(!Number.isInteger(cellPixels)||cellPixels<16||cellPixels>512||cellPixels%2)throw Error('逻辑格边长需为 16–512 的偶数像素');
  if(!Number.isFinite(ppu)||ppu<=0||ppu>10000)throw Error('PPU 必须大于 0 且不超过 10000');
  if(!['layered','continuous'].includes(strategy))throw Error('未知生产策略');
  if(strategy==='continuous'&&cellPixels>144)throw Error('连续策略画布超过 4096 px；请选择分层策略或显式降低格边长');
  const c=cellPixels,canvas=masterPixels??8*c;
  if(!Number.isInteger(canvas)||canvas%2||canvas<2*c||canvas>4096)throw Error('分层母版边长需为不小于2格、最多4096的偶数像素');
  if(strategy==='continuous'&&masterPixels!==undefined&&masterPixels!==28*c)throw Error('连续策略母版边长由28格推导');
  const panel=strategy==='layered'?canvas/2:4*c,overhang=template.kind==='stone'?Math.ceil(c/12):0,top=template.kind==='stone'?c/2:0;
  const panels=[{role:'surface',label:'连续表面',x:0,y:0},{role:'edge',label:template.kind==='grass'?'草叶边缘材质':'石沿与接触材质',x:panel,y:0},{role:'underlay',label:template.kind==='grass'?'底层土色':'暗面与厚度',x:0,y:panel},{role:'accent',label:template.kind==='grass'?'少量叶片':'少量破损石块',x:panel,y:panel}].map(p=>({...p,width:panel,height:panel}));
  if(strategy==='continuous'&&!continuous)continuous=continuousBoard();
  const sprite={width:c+2*overhang,height:c+top,pivot:{x:.5,y:(c/2)/(c+top)},logicalRect:{x:overhang,y:top,width:c,height:c},overhang:{left:overhang,right:overhang,top,bottom:0}};
  const tiles=MASKS.map((mask,index)=>({id:`mask-${String(mask).padStart(3,'0')}`,mask,index,
    sourceCell:strategy==='continuous'?{...continuous.found.get(mask)}:{x:0,y:0},
    sourceRect:strategy==='continuous'?{x:continuous.found.get(mask).x*c,y:continuous.found.get(mask).y*c,width:c,height:c}:{x:Math.floor((panel-c)/2),y:Math.floor((panel-c)/2),width:c,height:c}}));
  return {schemaVersion:'2dw-tile-grammar/1',template:{...template},strategy,cellPixels:c,ppu,worldCellSize:c/ppu,sprite,
    master:{width:strategy==='layered'?canvas:28*c,height:strategy==='layered'?canvas:28*c,maxAiRegionEdge:4096,panels:strategy==='layered'?panels:[],alpha:'opaque-required'},
    tiles,board:strategy==='continuous'?continuous.board:null,
    locked:['dimensions','cut-map','neighbor-bits','pivot','alpha-shape','overhang','layer-roles'],
    drawable:['material-blocks','limited-color-variation','optional-local-material-detail'],
    bits:Object.fromEntries(DIRECTIONS.map(([x,y,bit])=>[`${x},${y}`,bit])),
    sorting:{mode:'row-back-to-front-candidate',sourceVerified:false},artAcceptance:'pending-human-review'};
}
function testScenes(){
  const parse=lines=>lines.map(s=>[...s].map(c=>c==='#'?1:0));
  return {L:parse(['.....','.##..','.#...','.###.','.....']),T:parse(['.....','.###.','..#..','..#..','.....']),U:parse(['.....','.#.#.','.#.#.','.###.','.....']),hole:parse(['.....','.###.','.#.#.','.###.','.....']),island:parse(['.....','.#.#.','.....','..#..','.....']),line:parse(['.....','.....','#####','.....','.....']),random5:randomBoard(5,17),random8:randomBoard(8,19),random16:randomBoard(16,23)};
}
module.exports={TEMPLATES,DIRECTIONS,MASKS,normalizeMask,maskAt,makeGrammar,testScenes};
