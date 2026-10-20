export const defaults={copy:'Ctrl+C',paste:'Ctrl+V',move:'G'};
export type SelectionCommand=keyof typeof defaults;
let bindings={...defaults};try{const saved=JSON.parse(localStorage.getItem('workshop-selection-shortcuts')??'{}');for(const key of Object.keys(defaults) as SelectionCommand[])if(typeof saved[key]==='string')bindings[key]=saved[key];}catch{}
export function shortcutKey(e:KeyboardEvent){return [(e.ctrlKey||e.metaKey)?'Ctrl':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.key.length===1?e.key.toUpperCase():e.key].filter(Boolean).join('+');}
export function getShortcuts(){return {...bindings};}
export function setShortcut(command:SelectionCommand,value:string){
 if(!/^(Ctrl\+)?(Alt\+)?(Shift\+)?[A-Z0-9]$/.test(value))throw Error('请使用字母或数字，可搭配 Ctrl / Alt / Shift');
 if(['Ctrl+S','Ctrl+Z','Ctrl+Y','Ctrl+A','Ctrl+Shift+Z','S','X','Y','Z','I'].includes(value))throw Error('此按键已用于保存、撤销、选择或建模操作');
 if(Object.entries(bindings).some(([k,v])=>k!==command&&v===value))throw Error('快捷键重复');
 bindings[command]=value;localStorage.setItem('workshop-selection-shortcuts',JSON.stringify(bindings));
}
export function resetShortcuts(){bindings={...defaults};localStorage.removeItem('workshop-selection-shortcuts');}
