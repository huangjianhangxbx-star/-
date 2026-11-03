using System;
using System.Collections.Generic;

namespace XingHai.SB03
{
    [Serializable] public sealed class BridgeSpec
    {
        public string Id="bridge";
        public float Length=14,Width=2.5f,DeckHeight=2,StartHeight=0,EndHeight=0,ArchWidth=4,ArchHeight=1.25f;
        public bool Opening=true,Rails=true;
        public BridgeSpec Clone(){return (BridgeSpec)MemberwiseClone();}
    }
    [Serializable] public sealed class BridgePart
    { public string Id,SourceId,Role; public float X,Y,Z,Yaw; }
    [Serializable] public sealed class BridgeSolid
    { public string Id,Role; public float MinX,MaxX,MinY,MaxY,MinZ,MaxZ; }
    public sealed class BridgePlan
    {
        public bool Valid;public string Message;public BridgeSpec Spec;
        public readonly List<BridgePart> Parts=new List<BridgePart>();
        public readonly List<BridgeSolid> Solids=new List<BridgeSolid>();
        public float DeckStart,DeckEnd,OpeningMinX,OpeningMaxX,OpeningCrown;
        public int StartSteps,EndSteps;
        // Fixed-width tread sources are repeated, never stretched. The last tread
        // on each approach reaches the level deck and creates its landing.
        public float WalkingHeightAt(float x)
        {
            if(Spec==null)return 0;
            if(x<0)return Spec.StartHeight;
            if(x>=Spec.Length)return Spec.EndHeight;
            if(x<DeckStart)return Spec.StartHeight+((int)Math.Floor(x/.5f)+1)*.25f;
            if(x>=DeckEnd)return Spec.EndHeight+((int)Math.Ceiling((Spec.Length-x)/.5f))*.25f;
            return Spec.DeckHeight;
        }
        // Quantized elliptical soffit. The sample is at the centre of each
        // structural quarter-metre column, shared by core and decorative stones.
        public float OpeningHeightAt(float x)
        {
            if(Spec==null||!Spec.Opening||x<OpeningMinX||x>=OpeningMaxX)return 0;
            float centre=OpeningMinX+((int)Math.Floor((x-OpeningMinX)/.25f)+.5f)*.25f;
            double t=(centre-(OpeningMinX+OpeningMaxX)*.5)/((OpeningMaxX-OpeningMinX)*.5);
            double ellipse=OpeningCrown*Math.Sqrt(Math.Max(0,1-t*t));
            return Math.Max(.25f,(float)(Math.Floor(ellipse/.25+.5)*.25));
        }
        public bool ContainsOpening(float x,float y,float z)
        {return Valid&&Spec.Opening&&y>=0&&y<OpeningHeightAt(x)&&Math.Abs(z)<=Spec.Width*.5f;}
    }
}
