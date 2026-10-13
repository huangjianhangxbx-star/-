export type Point={x:number;y:number};
export function dataCellAt(px:number,py:number,cell:number,width:number,height:number):Point|null;
export function renderCellAt(px:number,py:number,cell:number,width:number,height:number):Point|null;
export function lineCells(a:Point,b:Point,value:number):Array<Point&{value:number}>;
export function rectangleCells(a:Point,b:Point,value:number):Array<Point&{value:number}>;
