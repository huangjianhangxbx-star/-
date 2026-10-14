export type Look2D={mode:'Source'|'DungeonLight'|'MaterialLight';lights:boolean;air:boolean;grade:boolean;bloom:boolean;dust:boolean;zoom:number;groundSize:number;wallScale:number;anchorY:number;ground:'mixed'|'base';debug:boolean;grid:boolean;footprints:boolean;images:boolean;baselines:boolean;follow:boolean};
export const defaultLook=():Look2D=>({mode:'DungeonLight',lights:true,air:true,grade:true,bloom:true,dust:true,zoom:1,groundSize:4,wallScale:1,anchorY:-.45,ground:'mixed',debug:false,grid:true,footprints:true,images:true,baselines:true,follow:true});
export const vertex2D=`varying vec2 vUv;varying vec2 vWorld;void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);vWorld=vec2(p.x,-p.y);gl_Position=projectionMatrix*viewMatrix*p;}`;
/** Finite 2D lighting, semantic density and scattering. Z is draw order only. */
export const fragment2D=`uniform sampler2D map;uniform sampler2D walls;uniform vec2 texel;uniform float mode,lightOn,airOn,gradeOn,bloomOn,dustOn,role,clock;varying vec2 vUv;varying vec2 vWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1,0)),f.x),mix(hash(a+vec2(0,1)),hash(a+1.),f.x),f.y);}
float occ(vec2 p){return texture2D(walls,(floor(p+.5)+.5)/vec2(48,32)).r;}
float lamp(vec2 p,vec4 l){vec2 d=p-l.xy;float v=1.;for(int i=1;i<=24;i++){v*=1.-occ(l.xy+d*(float(i)/26.))*.96;}return exp(-length(d)*.30)*max(0.,1.-length(d)/(l.z*1.7))*l.w*v*(.70+.30*noise(p*.7+vec2(5,1)));}
void main(){vec4 c=texture2D(map,vUv);if(c.a<.003)discard;if(mode>.5){float l0=lamp(vWorld,vec4(11,12,7,1.6))*lightOn,l1=lamp(vWorld,vec4(26,16,8,1.4))*lightOn,l2=lamp(vWorld,vec4(37,13,8,1.4))*lightOn;float lit=l0+l1+l2;
vec3 ambient=mode<1.5?vec3(.43,.51,.60):vec3(.95,1.03,1.12);vec3 warmth=vec3(1.04,.82,.58)*lit;float protection=role>1.5?.16:0.;c.rgb*=ambient+warmth+protection;
float n=.72+.28*noise(vWorld*.45+vec2(clock*.025,0));float density=airOn*.18*n*(role>1.5?.35:role>.5?1.:.42);float transmit=exp(-density);c.rgb=c.rgb*transmit+vec3(.033,.047,.052)*(1.-transmit)+vec3(1.,.66,.28)*lit*density*.13;
float dark=mode<1.5?.12*(.6+.4*noise(vWorld*.17))*(1.-min(1.,lit)):0.;c.rgb*=1.-dark;
if(bloomOn>.5){vec3 a=texture2D(map,vUv+vec2(texel.x*2.,0)).rgb+texture2D(map,vUv-vec2(texel.x*2.,0)).rgb+texture2D(map,vUv+vec2(0,texel.y*2.)).rgb+texture2D(map,vUv-vec2(0,texel.y*2.)).rgb;c.rgb+=max(a*.25-.08,0.)*.06*lit;}
if(gradeOn>.5)c.rgb=(c.rgb-vec3(.018))*1.025+vec3(.017,.02,.023);
float dust=step(.994,hash(floor(vWorld*8.+vec2(clock*.02,clock*.011))))*dustOn*min(1.,lit)*.035;c.rgb+=vec3(1.,.82,.50)*dust;}
gl_FragColor=vec4(max(c.rgb,0.),c.a);
#include <colorspace_fragment>
}`;
