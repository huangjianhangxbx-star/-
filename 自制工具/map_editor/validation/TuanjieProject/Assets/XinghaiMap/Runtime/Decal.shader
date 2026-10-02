Shader "Xinghai/Horizontal Decal" {
 Properties {_MainTex("Texture",2D)="white"{}}
 SubShader {Tags {"Queue"="Transparent" "RenderType"="Transparent"} Blend SrcAlpha OneMinusSrcAlpha ZWrite Off ZTest LEqual Offset -1,-1 Cull Back
 Pass {CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 struct V{float4 vertex:POSITION;float2 uv:TEXCOORD0;};struct F{float4 pos:SV_POSITION;float2 uv:TEXCOORD0;};sampler2D _MainTex;
 F vert(V v){F o;o.pos=UnityObjectToClipPos(v.vertex);o.uv=v.uv;return o;}
 fixed4 frag(F f):SV_Target{return tex2D(_MainTex,f.uv);}
 ENDCG }
 }
}
