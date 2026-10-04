Shader "Xinghai/Exchange Double Sided" {
 Properties {
  _Color("Base Color",Color)=(1,1,1,1)
  _MainTex("Base Color Texture",2D)="white"{}
  _Metallic("Metallic",Range(0,1))=0
  _Glossiness("Smoothness",Range(0,1))=.5
  [HDR] _EmissionColor("Emission",Color)=(0,0,0,0)
  _Cutoff("Alpha Cutoff",Range(0,1))=.5
  [HideInInspector] _Mode("Mode",Float)=0
  [HideInInspector] _SrcBlend("Src",Float)=1
  [HideInInspector] _DstBlend("Dst",Float)=0
  [HideInInspector] _ZWrite("ZWrite",Float)=1
 }
 SubShader {
  Tags {"RenderType"="Opaque" "Queue"="Geometry"}
  Cull Off
  ZWrite [_ZWrite]
  CGPROGRAM
  #pragma surface surf Standard fullforwardshadows addshadow
  #pragma target 3.0
  #pragma shader_feature_local _ALPHATEST_ON
  #pragma shader_feature_local _EMISSION
  sampler2D _MainTex;fixed4 _Color;half _Metallic,_Glossiness,_Cutoff;half4 _EmissionColor;
  struct Input {float2 uv_MainTex;float facing:VFACE;};
  void surf(Input IN,inout SurfaceOutputStandard o){
   fixed4 c=tex2D(_MainTex,IN.uv_MainTex)*_Color;
   #if defined(_ALPHATEST_ON)
   clip(c.a-_Cutoff);
   #endif
   o.Albedo=c.rgb;o.Alpha=c.a;o.Metallic=_Metallic;o.Smoothness=_Glossiness;
   o.Normal=float3(0,0,IN.facing>=0?1:-1);
   #if defined(_EMISSION)
   o.Emission=_EmissionColor.rgb;
   #endif
  }
  ENDCG
 }
 Fallback "Standard"
}
