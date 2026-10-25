/** Opt-in bounded diagnostics. Disabled in normal runs; never serialized into author files. */
type Probe={counts:Record<string,number>;samples:Record<string,number[]>};
function probe():Probe|undefined{return (globalThis as any).__paintPerformance;}
export function paintCount(name:string,n=1){const p=probe();if(p)p.counts[name]=(p.counts[name]??0)+n;}
export function paintSample(name:string,ms:number){const p=probe();if(!p)return;const xs=p.samples[name]??=[];if(xs.length===1024)xs.shift();xs.push(ms);}

export function paintBytes(name:string,data:unknown){if(probe())paintCount(name,new TextEncoder().encode(JSON.stringify(data)).byteLength);}
export function paintInput(){const p=probe() as (Probe&{input?:number})|undefined;if(p&&p.input===undefined)p.input=performance.now();}
export function paintSubmitted(){const p=probe() as (Probe&{input?:number})|undefined;if(p&&p.input!==undefined){paintSample('previewSubmit',performance.now()-p.input);delete p.input;}}
