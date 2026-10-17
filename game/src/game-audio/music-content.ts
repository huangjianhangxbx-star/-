import type {MusicChoice} from './policy';
export type MusicBinding={file:string;version:string;section:string;start:number;end?:number};
export type MusicBindings=Partial<Record<MusicChoice['id'],MusicBinding>>;
const home:MusicBinding={file:'home',version:'1',section:'whole-file-evaluation',start:0};
export const LOCAL_MUSIC:MusicBindings={title:{file:'title',version:'1',section:'whole-file-evaluation',start:0},explore:home,'explore-far':home,combat:{file:'chapter1',version:'1',section:'whole-file-evaluation',start:0}};
/** Rule names are deliberately absent. Sections and loop specifications are part of content identity. */
export function musicPlaybackKey(content:string,version:string,section:string,loopStart:number,loopEnd:number){return JSON.stringify([content,version,section,loopStart,loopEnd]);}
