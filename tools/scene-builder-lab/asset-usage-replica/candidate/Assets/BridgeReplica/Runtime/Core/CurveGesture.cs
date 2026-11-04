using System;
using System.Collections.Generic;

namespace XingHai.BridgeReplica
{
    // Pure gesture edits. The caller owns input capture, accepted candidates,
    // one-gesture Undo and conversion from world to author-local coordinates.
    public static class CurveGesture
    {
        const float E=.00001f,Retraction=.1f,KeyTolerance=.1f;
        sealed class HeightStation {public float Arc,Y;public int Index;}
        static bool Finite(float value){return !float.IsNaN(value)&&!float.IsInfinity(value);}
        static float Distance(RouteNode a,RouteNode b)
        {double x=(double)b.X-a.X,z=(double)b.Z-a.Z;return (float)Math.Sqrt(x*x+z*z);}
        static void Point(RouteNode p,bool height)
        {if(p==null||!Finite(p.X)||!Finite(p.Z)||(height&&!Finite(p.Y)))throw new ArgumentException("笔迹点需要有限坐标。");}
        static List<float> Arcs(List<RouteNode> nodes)
        {
            if(nodes==null||nodes.Count==0)throw new ArgumentException("路径至少需要一个点。");
            var arcs=new List<float>{0};Point(nodes[0],true);
            for(int i=1;i<nodes.Count;i++){Point(nodes[i],true);arcs.Add(arcs[i-1]+Distance(nodes[i-1],nodes[i]));}
            return arcs;
        }
        static RouteNode Between(RouteNode a,RouteNode b,float t,string id)
        {return new RouteNode{Id=id,X=a.X+(b.X-a.X)*t,Y=a.Y+(b.Y-a.Y)*t,Z=a.Z+(b.Z-a.Z)*t};}
        static RouteDocument Valid(RouteDocument doc)
        {var solved=CurveSolver.Solve(doc);if(!solved.Valid)throw new ArgumentException(solved.Message);return doc;}
        static float ProjectNodes(List<RouteNode> nodes,List<float> arcs,RouteNode point,out float arc,out RouteNode foot)
        {
            Point(point,false);arc=0;foot=nodes[0].Clone();double best=double.PositiveInfinity;
            for(int i=0;i<Math.Max(1,nodes.Count-1);i++)
            {
                var a=nodes[i];var b=nodes[Math.Min(nodes.Count-1,i+1)];
                double dx=(double)b.X-a.X,dz=(double)b.Z-a.Z,den=dx*dx+dz*dz;
                float t=den<1e-12?0:(float)Math.Max(0,Math.Min(1,(((double)point.X-a.X)*dx+((double)point.Z-a.Z)*dz)/den));
                var candidate=Between(a,b,t,t<=E?a.Id:t>=1-E?b.Id:"projection");
                double x=(double)point.X-candidate.X,z=(double)point.Z-candidate.Z,distance=x*x+z*z;
                float at=arcs[i]+(arcs[Math.Min(nodes.Count-1,i+1)]-arcs[i])*t;
                // An exact tie on a shared/nearby path chooses the latest
                // station, preventing a retraction from skipping an extra loop.
                if(distance<best-1e-12||(Math.Abs(distance-best)<=1e-12&&at>arc))
                {best=distance;arc=at;foot=candidate;}
            }
            return (float)Math.Sqrt(best);
        }
        public static float Project(RouteDocument route,RouteNode point,out float arc,out RouteNode foot)
        {
            if(route==null)throw new ArgumentException("缺少作者路径。");
            var arcs=Arcs(route.Nodes);return ProjectNodes(route.Nodes,arcs,point,out arc,out foot);
        }
        public static bool TryRetract(List<RouteNode> accepted,RouteNode pointer,float tolerance,out List<RouteNode> trimmed)
        {
            trimmed=null;
            if(accepted==null||accepted.Count<2)return false;
            if(!Finite(tolerance)||tolerance<0)throw new ArgumentException("回拉距离必须有限且非负。");
            var arcs=Arcs(accepted);float arc;RouteNode foot;
            if(ProjectNodes(accepted,arcs,pointer,out arc,out foot)>tolerance+E||arcs[arcs.Count-1]-arc<Retraction-E)return false;
            trimmed=new List<RouteNode>();
            for(int i=0;i<accepted.Count;i++)
            {
                if(arcs[i]<arc-E)trimmed.Add(accepted[i].Clone());
                else if(Math.Abs(arcs[i]-arc)<=E){trimmed.Add(accepted[i].Clone());return true;}
                else
                {
                    foot.Id=(accepted[Math.Max(0,i-1)].Id??"point")+"-retract";
                    trimmed.Add(foot);return true;
                }
            }
            return true;
        }
        public static RouteDocument TrimAuthor(RouteDocument original,bool fromFirst,float cutArc,string cutId)
        {
            if(original==null||original.Nodes==null||original.Nodes.Count<2)throw new ArgumentException("裁短需要现有作者路径。");
            var arcs=Arcs(original.Nodes);float length=arcs[arcs.Count-1];
            if(!Finite(cutArc)||cutArc<-E||cutArc>length+E)throw new ArgumentException("裁短位置超出原路径。");
            cutArc=Math.Max(0,Math.Min(length,cutArc));
            if((fromFirst?length-cutArc:cutArc)<.5f-E)throw new ArgumentException("裁短后至少保留0.5米路径。");
            int exact=-1;for(int i=0;i<arcs.Count;i++)if(Math.Abs(arcs[i]-cutArc)<=E){exact=i;break;}
            RouteNode cut=null;int before=0;
            if(exact<0)
            {
                if(string.IsNullOrWhiteSpace(cutId)||cutId.Contains("__"))throw new ArgumentException("裁短端点需要稳定且有效的身份。");
                while(before+1<arcs.Count&&arcs[before+1]<cutArc)before++;
                cut=Between(original.Nodes[before],original.Nodes[before+1],(cutArc-arcs[before])/(arcs[before+1]-arcs[before]),cutId);
            }
            var doc=original.Clone();doc.Nodes.Clear();
            if(fromFirst)
            {
                if(cut!=null)doc.Nodes.Add(cut);
                for(int i=exact>=0?exact:before+1;i<original.Nodes.Count;i++)doc.Nodes.Add(original.Nodes[i].Clone());
            }
            else
            {
                for(int i=0;i<=(exact>=0?exact:before);i++)doc.Nodes.Add(original.Nodes[i].Clone());
                if(cut!=null)doc.Nodes.Add(cut);
            }
            var retained=new HashSet<string>(StringComparer.Ordinal);
            for(int i=1;i<doc.Nodes.Count;i++)retained.Add(RouteDocument.GetSegmentId(doc.Nodes[i-1].Id,doc.Nodes[i].Id));
            foreach(var opening in original.Openings)
                if(opening.Enabled&&!retained.Contains(opening.SegmentId))throw new ArgumentException("裁短会切断或移除已启用洞口；请保留该洞口的完整原路段。");
            doc.Openings.RemoveAll(o=>!retained.Contains(o.SegmentId));
            return Valid(doc);
        }
        public static List<RouteNode> ProfileKeys(RouteDocument doc)
        {
            if(doc==null)throw new ArgumentException("缺少高度路径。");
            var arcs=Arcs(doc.Nodes);var keys=new List<RouteNode>{doc.Nodes[0].Clone()};
            for(int i=1;i<doc.Nodes.Count-1;i++)
            {
                float a=arcs[i]-arcs[i-1],b=arcs[i+1]-arcs[i];
                if(a<E||b<E)throw new ArgumentException("高度路径不能在同一水平位置垂直跳变。");
                float before=(doc.Nodes[i].Y-doc.Nodes[i-1].Y)/a,after=(doc.Nodes[i+1].Y-doc.Nodes[i].Y)/b;
                if(Math.Abs(before-after)>E)keys.Add(doc.Nodes[i].Clone());
            }
            if(doc.Nodes.Count>1)keys.Add(doc.Nodes[doc.Nodes.Count-1].Clone());return keys;
        }
        static float HeightAt(List<HeightStation> profile,float arc)
        {
            if(arc<=profile[0].Arc)return profile[0].Y;
            for(int i=1;i<profile.Count;i++)if(arc<=profile[i].Arc)
            {
                var a=profile[i-1];var b=profile[i];return a.Y+(b.Y-a.Y)*(arc-a.Arc)/(b.Arc-a.Arc);
            }
            return profile[profile.Count-1].Y;
        }
        public static RouteDocument ApplyHeightProfile(RouteDocument contour,List<RouteNode> keys)
        {
            if(contour==null||contour.Nodes==null||contour.Nodes.Count<2)throw new ArgumentException("高度编辑需要已拟合的水平轮廓。");
            var arcs=Arcs(contour.Nodes);var doc=contour.Clone();
            if(keys==null||keys.Count==0)return Valid(doc);
            var profile=new List<HeightStation>();
            for(int i=0;i<keys.Count;i++)
            {
                Point(keys[i],true);if(keys[i].Y<0||keys[i].Y>8)throw new ArgumentException("高度支持0—8米。");
                float arc;RouteNode foot;
                if(ProjectNodes(contour.Nodes,arcs,keys[i],out arc,out foot)>KeyTolerance+E)throw new ArgumentException("高度锚点偏离拟合轮廓超过0.1米。");
                if(profile.Count>0)
                {
                    var previous=profile[profile.Count-1];
                    if(arc<previous.Arc-E)throw new ArgumentException("高度锚点必须沿绘制方向单调排列。");
                    if(Math.Abs(arc-previous.Arc)<=E)
                    {if(Math.Abs(keys[i].Y-previous.Y)>E)throw new ArgumentException("同一水平位置不能有两个不同高度。");continue;}
                }
                profile.Add(new HeightStation{Arc=arc,Y=keys[i].Y,Index=i});
            }
            // A height turn must survive XZ simplification. An unchanged
            // planar author node keeps its exact XZ and identity; only the
            // necessary profile corners get new, deterministic identities.
            var turns=new List<HeightStation>();float length=arcs[arcs.Count-1];
            for(int i=0;i<profile.Count;i++)
            {
                var p=profile[i];float before=i==0?0:(p.Y-profile[i-1].Y)/(p.Arc-profile[i-1].Arc);
                float after=i==profile.Count-1?0:(profile[i+1].Y-p.Y)/(profile[i+1].Arc-p.Arc);
                if(p.Arc>E&&p.Arc<length-E&&Math.Abs(before-after)>E)turns.Add(p);
            }
            var ids=new HashSet<string>(StringComparer.Ordinal);foreach(var n in contour.Nodes)ids.Add(n.Id);
            doc.Nodes.Clear();
            for(int i=0;i<contour.Nodes.Count;i++)
            {
                var original=contour.Nodes[i].Clone();original.Y=HeightAt(profile,arcs[i]);doc.Nodes.Add(original);
                if(i==contour.Nodes.Count-1)continue;
                foreach(var turn in turns)
                {
                    if(turn.Arc<=arcs[i]+E||turn.Arc>=arcs[i+1]-E)continue;
                    string id="height-"+turn.Index;int suffix=0;while(!ids.Add(id))id="height-"+turn.Index+"-"+(++suffix);
                    var node=Between(contour.Nodes[i],contour.Nodes[i+1],(turn.Arc-arcs[i])/(arcs[i+1]-arcs[i]),id);node.Y=turn.Y;doc.Nodes.Add(node);
                }
            }
            // Validate on the final fitted XZ length, not the noisier raw arc.
            // Continuous ramp nodes are intentional; rendered steps are 0.25m.
            return Valid(doc);
        }
    }
}
