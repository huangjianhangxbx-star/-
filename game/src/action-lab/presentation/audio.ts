/** Original recordings, explicitly SAMPLE event bindings. */
export class LabAudio {
 private context?:AudioContext;private buffers=new Map<string,AudioBuffer>();private active=new Set<AudioBufferSourceNode>();private loading?:Promise<void>;private yellowLoading?:Promise<void>;muted=false;
 prepare():Promise<void>{
  this.context??=new AudioContext();
  return this.loading??=Promise.all(['release','hit','hurt'].map(async n=>{const r=await fetch(`/__al01-assets/audio/${n}.wav`);if(!r.ok)throw new Error(`音效缺失 ${n}`);this.buffers.set(n,await this.context!.decodeAudioData(await r.arrayBuffer()));})).then(()=>{});
 }
 prepareYellow():Promise<void>{
  this.context??=new AudioContext();
  return this.yellowLoading??=Promise.all(Object.entries({'yellow.fire':'cannon-fire','yellow.gatling':'gatling-fire','yellow.hit':'cannon-hit','yellow.reload':'reload-complete'}).map(async([cue,file])=>{
   const r=await fetch(`/__al01-assets/audio/${file}.wav`);if(!r.ok)throw new Error(`射击音效缺失 ${file}`);this.buffers.set(cue,await this.context!.decodeAudioData(await r.arrayBuffer()));
  })).then(()=>{});
 }
 async unlock():Promise<void>{await this.prepare();await this.context!.resume();}
 play(name:string):void{if(this.muted||!this.context||this.context.state==='closed'||(this.context.state!=='running'&&!name.startsWith('yellow.'))||!this.buffers.has(({block:'hit',dodge:'release',return:'hit'} as Record<string,string>)[name]??name))return;
  const node=this.context.createBufferSource(),gain=this.context.createGain();node.buffer=this.buffers.get(({block:'hit',dodge:'release',return:'hit'} as Record<string,string>)[name]??name)!;node.playbackRate.value=({block:.8,dodge:1.25,return:1.3} as Record<string,number>)[name]??1;gain.gain.value=name==='release'?.14:.22;node.connect(gain);gain.connect(this.context.destination);this.active.add(node);node.onended=()=>{this.active.delete(node);node.disconnect();gain.disconnect();};node.start();
 }
 stop():void{for(const n of this.active)n.stop();this.active.clear();}
 dispose():void{this.stop();void this.context?.close();}
}
