export function adjustColor(hex:string,brightness:number,contrast:number,saturation:number){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),gray=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 return '#'+rgb.map(v=>{v=gray+(v-gray)*(1+saturation/100);v=(v-.5)*(1+contrast/100)+.5+brightness/100;return Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0');}).join('');
}
