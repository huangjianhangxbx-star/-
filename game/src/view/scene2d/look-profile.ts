export type Lamp2D={enabled:boolean;x:number;y:number;color:string;intensity:number;radius:number};
export type Look2D={mode:'Source'|'DungeonLight'|'MaterialLight';lights:boolean;air:boolean;grade:boolean;bloom:boolean;dust:boolean;zoom:number;groundSize:number;wallScale:number;anchorY:number;ground:'mixed'|'base';debug:boolean;grid:boolean;footprints:boolean;images:boolean;baselines:boolean;follow:boolean;ambientIntensity:number;ambientColor:string;lamps:Lamp2D[];frozen:boolean};
export const defaultLook=():Look2D=>({mode:'DungeonLight',lights:true,air:true,grade:true,bloom:false,dust:false,zoom:1,groundSize:400/341,wallScale:1,anchorY:-.45,ground:'mixed',debug:false,grid:true,footprints:true,images:true,baselines:true,follow:true,ambientIntensity:.07,ambientColor:'#b0bdcb',frozen:true,lamps:[{enabled:true,x:11,y:12,color:'#ffd9a2',intensity:3.2,radius:9},{enabled:true,x:26,y:16,color:'#ffd9a2',intensity:3,radius:9},{enabled:true,x:37,y:13,color:'#ffd9a2',intensity:3,radius:9}]});
export const vertex2D=`varying vec2 vUv;varying vec2 vWorld;void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);vWorld=vec2(p.x,-p.y);gl_Position=projectionMatrix*viewMatrix*p;}`;
/** Linear source × shared 2D illumination, then air, then one output conversion. */
export const fragment2D=`uniform sampler2D map;uniform sampler2D walls;uniform vec2 mapSize;uniform vec2 texel,surfaceCell;uniform vec4 lamps[3];uniform vec3 lampColors[3],ambientColor;uniform float ambientIntensity;uniform float mode,lightOn,airOn,gradeOn,bloomOn,dustOn,role,clock;varying vec2 vUv;varying vec2 vWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1,0)),f.x),mix(hash(a+vec2(0,1)),hash(a+1.),f.x),f.y);}
float occ(vec2 p){vec2 cell=floor(p+.5);if(role>.5&&role<1.5&&all(lessThan(abs(cell-surfaceCell),vec2(.1))))return 0.;if(any(lessThan(cell,vec2(0)))||any(greaterThanEqual(cell,mapSize)))return 0.;return texture2D(walls,(cell+.5)/mapSize).r;}
float lamp(vec2 p,vec4 l){if(l.w<=0.)return 0.;vec2 d=p-l.xy;float dist=length(d);if(dist>=l.z)return 0.;float v=1.;for(int i=1;i<=24;i++){v*=1.-occ(l.xy+d*(float(i)/26.))*.96;}return exp(-dist*.30)*max(0.,1.-dist/l.z)*l.w*v*(.70+.30*noise(p*.7+vec2(5,1)));}
void main(){vec4 c=texture2D(map,vUv);if(c.a<.003)discard;if(mode>.5){vec2 receiver=role>.5&&role<1.5?clamp(vWorld,surfaceCell-vec2(.49),surfaceCell+vec2(.49)):vWorld;vec3 local=vec3(0);float lit=0.;for(int i=0;i<3;i++){float l=lamp(receiver,lamps[i])*lightOn;local+=lampColors[i]*l;lit+=l;}vec3 illumination=ambientColor*ambientIntensity+local;
c.rgb*=illumination; // no fixed character self-light
float n=.72+.28*noise(vWorld*.45+vec2(clock*.025,0));float density=airOn*.18*n*(role>1.5?.35:role>.5?1.:.42);float transmit=exp(-density);c.rgb=c.rgb*transmit+ambientColor*ambientIntensity*.025*(1.-transmit)+local*density*.13;
float dark=mode<1.5?.12*(.6+.4*noise(vWorld*.17))*(1.-min(1.,lit)):0.;c.rgb*=1.-dark;
if(bloomOn>.5){vec3 a=texture2D(map,vUv+vec2(texel.x*2.,0)).rgb+texture2D(map,vUv-vec2(texel.x*2.,0)).rgb+texture2D(map,vUv+vec2(0,texel.y*2.)).rgb+texture2D(map,vUv-vec2(0,texel.y*2.)).rgb;c.rgb+=max(a*.25*illumination-.6,0.)*.06;}
if(gradeOn>.5)c.rgb*=vec3(.99,1.01,1.025);
float dust=step(.994,hash(floor(vWorld*8.+vec2(clock*.02,clock*.011))))*dustOn*min(1.,lit)*.035;c.rgb+=vec3(1.,.82,.50)*dust;}
gl_FragColor=vec4(max(c.rgb,0.),c.a);
#include <colorspace_fragment>
}`;
