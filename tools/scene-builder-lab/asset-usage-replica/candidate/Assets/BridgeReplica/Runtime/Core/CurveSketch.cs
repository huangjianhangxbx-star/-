using System;
using System.Collections.Generic;

namespace XingHai.BridgeReplica
{
    public static class CurveSketch
    {
        const float Tolerance=.035f;
        static float Distance(RouteNode a,RouteNode b){float x=b.X-a.X,z=b.Z-a.Z;return (float)Math.Sqrt(x*x+z*z);}
        static bool Finite(float n){return !float.IsNaN(n)&&!float.IsInfinity(n);}
        static void Simplify(List<RouteNode> input,int first,int last,List<int> output)
        {
            var a=input[first];var b=input[last];float dx=b.X-a.X,dz=b.Z-a.Z,denom=dx*dx+dz*dz,best=0;int pick=-1;
            for(int i=first+1;i<last;i++)
            {var p=input[i];float t=denom<.0000001f?0:Math.Max(0,Math.Min(1,((p.X-a.X)*dx+(p.Z-a.Z)*dz)/denom));float x=p.X-a.X-t*dx,z=p.Z-a.Z-t*dz,d=x*x+z*z;if(d>best){best=d;pick=i;}}
            if(pick>=0&&best>Tolerance*Tolerance){Simplify(input,first,pick,output);output.RemoveAt(output.Count-1);Simplify(input,pick,last,output);}else{output.Add(first);output.Add(last);}
        }
        public static RouteDocument Build(List<RouteNode> samples,float defaultHeight=2,float width=2)
        {
            if(samples==null||samples.Count<2||samples.Count>4096)throw new ArgumentException("自由笔迹需要2—4096个采样点。");
            if(!Finite(defaultHeight)||defaultHeight<0||defaultHeight>8)throw new ArgumentException("新路线默认高度须为0—8米。");
            var clean=new List<RouteNode>();
            foreach(var p in samples)
            {
                if(p==null||!Finite(p.X)||!Finite(p.Z))throw new ArgumentException("笔迹坐标必须有限。");
                if(clean.Count==0||Distance(clean[clean.Count-1],p)>.002f)clean.Add(p.Clone());
            }
            if(clean.Count<2)throw new ArgumentException("笔迹过短，请继续绘制。");
            var selected=new List<int>();Simplify(clean,0,clean.Count-1,selected);
            var poly=new List<RouteNode>();foreach(int i in selected)poly.Add(new RouteNode{Id="stroke-"+i,X=clean[i].X,Z=clean[i].Z});
            var arcs=new List<float>{0};for(int i=1;i<poly.Count;i++)arcs.Add(arcs[i-1]+Distance(poly[i-1],poly[i]));float length=arcs[arcs.Count-1];
            if(length<.5f)throw new ArgumentException("继续绘制至至少0.5米，桥体就会出现。");
            // Only new strokes acquire automatic approaches. A saved author's
            // geometry is never silently rescaled when it is edited or reopened.
            float height=Math.Min(defaultHeight,(float)Math.Floor(Math.Max(0,(length-.5f)/4)/.25f)*.25f);
            var cuts=new List<float>(arcs);if(height>0){Insert(cuts,height*2);Insert(cuts,length-height*2);}cuts.Sort();
            var doc=new RouteDocument{SchemaVersion=2,Id="curve-stroke",Width=width,KitId="workshop.bridge.A",KitVersion="1"};
            foreach(float arc in cuts)
            {
                int existing=arcs.FindIndex(a=>Math.Abs(a-arc)<.0001f);RouteNode node;
                if(existing>=0)node=poly[existing].Clone();
                else
                {
                    int next=arcs.FindIndex(a=>a>arc);int prev=next-1;float t=(arc-arcs[prev])/(arcs[next]-arcs[prev]);
                    node=new RouteNode{Id=Math.Abs(arc-height*2)<.0001f?"approach-start":"approach-end",X=poly[prev].X+(poly[next].X-poly[prev].X)*t,Z=poly[prev].Z+(poly[next].Z-poly[prev].Z)*t};
                }
                node.Y=Math.Min(height,Math.Min(arc*.5f,(length-arc)*.5f));doc.Nodes.Add(node);
            }
            var solved=CurveSolver.Solve(doc);if(!solved.Valid)throw new ArgumentException(solved.Message);return doc;
        }
        static void Insert(List<float> list,float value){if(!list.Exists(a=>Math.Abs(a-value)<.0001f))list.Add(value);}
    }
    public static class CurveEdits
    {
        public static RouteDocument MoveNode(RouteDocument doc,int index,float x,float z)
        {var r=doc.Clone();r.Nodes[index].X=x;r.Nodes[index].Z=z;return r;}
        public static RouteDocument SetNodeHeight(RouteDocument doc,int index,float y)
        {var r=doc.Clone();r.Nodes[index].Y=y;return r;}
        public static RouteDocument Append(RouteDocument doc,float x,float y,float z)
        {var r=doc.Clone();r.Nodes.Add(new RouteNode{Id=Guid.NewGuid().ToString("N"),X=x,Y=y,Z=z});return r;}
        public static RouteDocument AppendStroke(RouteDocument doc,List<RouteNode> stroke)
        {
            if(stroke==null||stroke.Count<2)throw new ArgumentException("续画至少需要两个实际采样点。");
            var r=doc.Clone();var last=r.Nodes[r.Nodes.Count-1];
            if(Math.Sqrt(Math.Pow(stroke[0].X-last.X,2)+Math.Pow(stroke[0].Z-last.Z,2))>.1)throw new ArgumentException("续画必须从当前路线末端开始。");
            for(int i=1;i<stroke.Count;i++){var n=stroke[i].Clone();n.Id=Guid.NewGuid().ToString("N");r.Nodes.Add(n);}return r;
        }
        public static RouteDocument RemoveLast(RouteDocument doc)
        {
            if(doc==null||doc.Nodes.Count<=2)throw new ArgumentException("至少保留两个路线控制点。");
            var r=doc.Clone();string id=RouteDocument.GetSegmentId(r.Nodes[r.Nodes.Count-2].Id,r.Nodes[r.Nodes.Count-1].Id);r.Nodes.RemoveAt(r.Nodes.Count-1);r.Openings.RemoveAll(o=>o.SegmentId==id);return r;
        }
    }
}
