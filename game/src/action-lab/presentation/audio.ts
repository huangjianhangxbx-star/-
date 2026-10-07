/** Original recordings, explicitly SAMPLE event bindings. */
export class LabAudio {
 private context?:AudioContext;private buffers=new Map<string,AudioBuffer>();private active=new Set<AudioBufferSourceNode>();private loading?:Promise<void>;muted=false;
 prepare():Promise<void>{
  this.context??=new AudioContext();
  return this.loading??=Promise.all(['release','hit','hurt'].map(async n=>{const r=await fetch(`/__al01-assets/audio/${n}.wav`);if(!r.ok)throw new Error(`音效缺失 ${n}`);this.buffers.set(n,await this.context!.decodeAudioData(await r.arrayBuffer()));})).then(()=>{});
 }
 async unlock():Promise<void>{await this.prepare();await this.context!.resume();}
 play(name:string):void{if(this.muted||!this.context||this.context.state!=='running'||!this.buffers.has(name))return;
  const node=this.context.createBufferSource(),gain=this.context.createGain();node.buffer=this.buffers.get(name)!;gain.gain.value=name==='release'?.14:.22;node.connect(gain);gain.connect(this.context.destination);this.active.add(node);node.onended=()=>{this.active.delete(node);node.disconnect();gain.disconnect();};node.start();
 }
 stop():void{for(const n of this.active)n.stop();this.active.clear();}
 dispose():void{this.stop();void this.context?.close();}
}
