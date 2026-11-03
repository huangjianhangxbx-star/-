Shader "Hidden/XingHai/LE02BrushOverlay"
{
    Properties
    {
        _CoreColor ("Centre", Color) = (.35,.95,.78,.38)
        _EdgeColor ("Transition", Color) = (.25,.75,.9,.1)
    }
    SubShader
    {
        Tags { "Queue"="Transparent+100" "RenderType"="Transparent" }
        Pass
        {
            ZWrite Off
            ZTest LEqual
            Cull Back
            Blend SrcAlpha OneMinusSrcAlpha
            Offset -1, -1
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            float4 _CoreColor, _EdgeColor, _Center, _Radii, _HeightRange, _Footprint;
            float4x4 _WorldToAuthor;
            // Mode 0: native tops, 1: selected wall, 2: columns, 3: local wall.
            float _Mode;
            struct appdata { float4 vertex:POSITION; float3 normal:NORMAL; float2 range:TEXCOORD1; float2 tangent:TEXCOORD2; };
            struct v2f { float4 vertex:SV_POSITION; float3 local:TEXCOORD0; float3 localNormal:TEXCOORD1; float2 range:TEXCOORD2; float2 tangent:TEXCOORD3; };
            v2f vert(appdata v)
            {
                v2f o; o.vertex=UnityObjectToClipPos(v.vertex);
                float4 world=mul(unity_ObjectToWorld,v.vertex);
                o.local=mul(_WorldToAuthor,world).xyz;
                o.localNormal=mul((float3x3)_WorldToAuthor,UnityObjectToWorldNormal(v.normal));
                o.range=v.range;
                o.tangent=v.tangent;
                return o;
            }
            fixed4 frag(v2f i):SV_Target
            {
                float weight=1;
                if((_Mode>.5 && _Mode<1.5)||_Mode>2.5)
                {
                    clip(i.local.y-max(_HeightRange.x,i.range.x)); clip(min(_HeightRange.y,i.range.y)-i.local.y);
                    if(_HeightRange.z>0)weight=saturate(min(i.local.y-_HeightRange.x,_HeightRange.y-i.local.y)/_HeightRange.z);
                    if(_Mode>2.5)
                    {
                        float tangent=i.tangent.x-lerp(_Center.z,_Center.x,step(.5,i.tangent.y));
                        float height=(floor(i.local.y*16)+.5)/16-_Center.y;
                        float square=(tangent*tangent+height*height)/max(.000001,_Radii.x*_Radii.x);
                        clip(.999999-square);weight=(1-square)*(1-square);
                    }
                }
                else
                {
                    if(_Mode<.5)clip(i.localNormal.y-.35);
                    if(_Radii.z<.5)
                    {
                        float2 delta=i.local.xz-_Center.xz;
                        if(_Mode<.5&&_Footprint.w>.5)delta=float2((delta.x*_Footprint.x+delta.y*_Footprint.y)/max(1,_Footprint.z),-delta.x*_Footprint.y+delta.y*_Footprint.x);
                        float distance=length(delta);clip(_Radii.y-distance);weight=distance<=_Radii.x?1:1-smoothstep(_Radii.x,_Radii.y,distance);
                    }
                }
                fixed4 color=lerp(_EdgeColor,_CoreColor,weight);
                return color;
            }
            ENDCG
        }
    }
}
