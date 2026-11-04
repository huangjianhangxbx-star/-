using System;
using System.Collections.Generic;
using XingHai.SB03;

namespace XingHai.BridgeReplica
{
    // All coordinates are author-local metres. These stations are derived;
    // RouteDocument.Nodes remains the sole editable/persistent route authority.
    public sealed class CurveFrame
    {
        public float X,Y,Z,TangentX,TangentZ,NormalX,NormalZ,Arc;
        public float LeftX,LeftZ,RightX,RightZ,LeftArc,RightArc;
        public int SpanIndex;
        public CurveFrame Clone(){return (CurveFrame)MemberwiseClone();}
    }
    public sealed class CurveSpan
    {
        public string Id,StartNodeId,EndNodeId;
        public int Index;
        public float StartArc,EndArc,Length,StartHeight,EndHeight,TangentX,TangentZ;
        public bool HasOpening;
    }
    public sealed class CurveOpening
    {
        public string SegmentId;
        public float SpanStartArc,StartArc,EndArc;
        public BridgePlan Plan;
        public float HeightAt(float arc){return Plan==null?0:Plan.OpeningHeightAt(arc-SpanStartArc);}
        public bool Contains(float arc,float y,float lateral)
        {return Plan!=null&&Plan.ContainsOpening(arc-SpanStartArc,y,lateral);}
    }
    public sealed class CurveResult
    {
        public bool Valid;
        public string Message;
        public RouteDocument Document;
        public float Length;
        public List<CurveFrame> Frames=new List<CurveFrame>();
        public List<CurveSpan> Spans=new List<CurveSpan>();
        public List<CurveOpening> Openings=new List<CurveOpening>();
        public float OpeningHeightAt(float arc)
        {float height=0;foreach(var o in Openings)height=Math.Max(height,o.HeightAt(arc));return height;}
        public CurveFrame FrameAt(float arc){return Interpolate(arc,0);}
        // Edge lookups return an actual side position and side-segment tangent;
        // Arc remains the corresponding centre distance for height/opening queries.
        public CurveFrame EdgeFrameAt(bool left,float edgeArc){return Interpolate(edgeArc,left?1:2);}
        CurveFrame Interpolate(float value,int edge)
        {
            if(Frames.Count==0)throw new InvalidOperationException("没有有效路线截面。");
            if(Frames.Count==1)return Frames[0].Clone();
            int low=0,high=Frames.Count-1;
            value=Math.Max(Distance(Frames[0],edge),Math.Min(Distance(Frames[high],edge),value));
            while(high-low>1){int mid=(low+high)/2;if(Distance(Frames[mid],edge)<=value)low=mid;else high=mid;}
            var a=Frames[low];var b=Frames[high];float denominator=Distance(b,edge)-Distance(a,edge);
            float t=denominator<.000001f?0:(value-Distance(a,edge))/denominator;
            var f=new CurveFrame{X=Lerp(a.X,b.X,t),Y=Lerp(a.Y,b.Y,t),Z=Lerp(a.Z,b.Z,t),Arc=Lerp(a.Arc,b.Arc,t),LeftArc=Lerp(a.LeftArc,b.LeftArc,t),RightArc=Lerp(a.RightArc,b.RightArc,t),LeftX=Lerp(a.LeftX,b.LeftX,t),LeftZ=Lerp(a.LeftZ,b.LeftZ,t),RightX=Lerp(a.RightX,b.RightX,t),RightZ=Lerp(a.RightZ,b.RightZ,t),SpanIndex=t<.99999f?a.SpanIndex:b.SpanIndex};
            f.TangentX=Lerp(a.TangentX,b.TangentX,t);f.TangentZ=Lerp(a.TangentZ,b.TangentZ,t);
            if(edge!=0)
            {
                f.X=edge==1?f.LeftX:f.RightX;f.Z=edge==1?f.LeftZ:f.RightZ;
                f.TangentX=edge==1?b.LeftX-a.LeftX:b.RightX-a.RightX;
                f.TangentZ=edge==1?b.LeftZ-a.LeftZ:b.RightZ-a.RightZ;
            }
            float length=(float)Math.Sqrt(f.TangentX*f.TangentX+f.TangentZ*f.TangentZ);
            if(length>.000001f){f.TangentX/=length;f.TangentZ/=length;}
            f.NormalX=-f.TangentZ;f.NormalZ=f.TangentX;return f;
        }
        static float Lerp(float a,float b,float t){return a+(b-a)*t;}
        static float Distance(CurveFrame f,int edge){return edge==1?f.LeftArc:edge==2?f.RightArc:f.Arc;}
    }
}
