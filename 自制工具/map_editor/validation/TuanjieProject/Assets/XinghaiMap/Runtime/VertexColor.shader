Shader "Xinghai/Map Vertex Color" {
 SubShader { Tags {"RenderType"="Opaque"} LOD 100
 CGPROGRAM
 #pragma surface surf Lambert vertex:vert
 struct Input {float4 color:COLOR;};
 void vert(inout appdata_full v,out Input o){UNITY_INITIALIZE_OUTPUT(Input,o);o.color=v.color;}
 void surf(Input IN,inout SurfaceOutput o){o.Albedo=IN.color.rgb;o.Alpha=1;}
 ENDCG
 }
 Fallback "Diffuse"
}
