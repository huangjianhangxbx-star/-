using System;
using System.Collections.Generic;
using XingHai.SB03;

namespace XingHai.OldBridgeReplica
{
    [Serializable] public sealed class RouteNode
    {
        public string Id;
        public float X,Y,Z;
        public RouteNode Clone(){return (RouteNode)MemberwiseClone();}
    }
    [Serializable] public sealed class RouteOpening
    {
        public string SegmentId;
        public float Width=4,Height=1.25f;
        public bool Enabled=true;
        public RouteOpening Clone(){return (RouteOpening)MemberwiseClone();}
    }
    [Serializable] public sealed class RouteDocument
    {
        public int SchemaVersion=1,Revision;
        public string Id="route",KitId="sb03.bridge",KitVersion="v1";
        public float Width=2;
        public bool Rails=true;
        // Version 2 keeps horizontal author coordinates continuous. Version 1
        // remains interpreted by the original orthogonal solver.
        public float SampleSpacing=.25f,SimplifyTolerance=.04f;
        public List<RouteNode> Nodes=new List<RouteNode>();
        public List<RouteOpening> Openings=new List<RouteOpening>();
        public static string GetSegmentId(string a,string b){return a+"__"+b;}
        public RouteDocument Clone()
        {
            var copy=(RouteDocument)MemberwiseClone();
            copy.Nodes=Nodes==null?null:Nodes.ConvertAll(n=>n==null?null:n.Clone());
            copy.Openings=Openings==null?null:Openings.ConvertAll(n=>n==null?null:n.Clone());return copy;
        }
    }
    public sealed class RouteSegment
    {
        public string Id,StartNodeId,EndNodeId;
        public float StartX,StartZ,EndX,EndZ,Length,StartHeight,EndHeight,Yaw,DirX,DirZ;
        public bool HasOpening;
        public float OpeningStart,OpeningEnd,OpeningCrown;
        internal BridgePlan OpeningPlan;
        public float OpeningHeightAt(float localDistance){return OpeningPlan==null?0:OpeningPlan.OpeningHeightAt(localDistance);}
        public bool ContainsOpening(float x,float y,float z)
        {
            if(!HasOpening||OpeningPlan==null)return false;
            float dx=x-StartX,dz=z-StartZ;
            return OpeningPlan.ContainsOpening(dx*DirX+dz*DirZ,y,-dx*DirZ+dz*DirX);
        }
    }
    public sealed class RouteResult
    {
        public bool Valid;
        public string Message;
        public RouteDocument Document;
        // Render compatibility projection only; never persist this instead of Document.
        public BridgePlan Plan;
        public CurveResult Curve;
        public List<RouteSegment> Segments=new List<RouteSegment>();
    }
}
