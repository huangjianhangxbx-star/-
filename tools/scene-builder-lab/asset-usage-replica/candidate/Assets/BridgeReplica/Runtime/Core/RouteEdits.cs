using System;
namespace XingHai.BridgeReplica
{
    public static class RouteEdits
    {
        public static RouteDocument OffsetLeg(RouteDocument doc,int segmentIndex,float offset)
        {
            if(doc==null)throw new ArgumentNullException("doc");
            if(segmentIndex<=0||segmentIndex>=doc.Nodes.Count-2)throw new ArgumentException("只可偏移内部路段；起终点保持。");
            var r=doc.Clone();var a=doc.Nodes[segmentIndex];var b=doc.Nodes[segmentIndex+1];float dx=Math.Sign(b.X-a.X),dz=Math.Sign(b.Z-a.Z);
            if(dx!=0&&dz!=0)throw new ArgumentException("偏移前路段必须轴对齐。");
            r.Nodes[segmentIndex].X-=dz*offset;r.Nodes[segmentIndex+1].X-=dz*offset;r.Nodes[segmentIndex].Z+=dx*offset;r.Nodes[segmentIndex+1].Z+=dx*offset;return r;
        }
        public static RouteDocument SetNodeHeight(RouteDocument doc,int index,float y){var r=doc.Clone();r.Nodes[index].Y=y;return r;}
        public static RouteDocument Append(RouteDocument doc,float x,float y,float z){var r=doc.Clone();r.Nodes.Add(new RouteNode{Id=Guid.NewGuid().ToString("N"),X=x,Y=y,Z=z});return r;}
        public static RouteDocument RemoveLastSegment(RouteDocument doc)
        {
            if(doc==null||doc.Nodes.Count<=2)throw new ArgumentException("至少保留一个有效路段。");var r=doc.Clone();string removed=RouteDocument.GetSegmentId(r.Nodes[r.Nodes.Count-2].Id,r.Nodes[r.Nodes.Count-1].Id);r.Nodes.RemoveAt(r.Nodes.Count-1);r.Openings.RemoveAll(o=>o.SegmentId==removed);return r;
        }
    }
    public static class RouteSketch
    {
        static float Snap(float n,float quantum){return (float)Math.Round(n/quantum)*quantum;}
        static float Distance(RouteNode a,RouteNode b){return Math.Abs(a.X-b.X)+Math.Abs(a.Z-b.Z);}
        static RouteNode Point(float x,float y,float z){return new RouteNode{X=x,Y=y,Z=z};}
        static void Add(System.Collections.Generic.List<RouteNode> list,RouteNode p)
        {
            if(list.Count>0&&Distance(list[list.Count-1],p)<.0001f)return;
            if(list.Count>1)
            {
                var a=list[list.Count-2];var b=list[list.Count-1];
                if((a.X==b.X&&b.X==p.X&&(b.Z-a.Z)*(p.Z-b.Z)>0)||(a.Z==b.Z&&b.Z==p.Z&&(b.X-a.X)*(p.X-b.X)>0)){list[list.Count-1]=p;return;}
            }
            list.Add(p);
        }
        static void Simplify(System.Collections.Generic.List<RouteNode> input,int first,int last,System.Collections.Generic.List<RouteNode> output)
        {
            var a=input[first];var b=input[last];double dx=b.X-a.X,dz=b.Z-a.Z,denom=dx*dx+dz*dz;double best=0;int pick=-1;
            for(int i=first+1;i<last;i++)
            {var p=input[i];double t=denom<.0000001?0:Math.Max(0,Math.Min(1,((p.X-a.X)*dx+(p.Z-a.Z)*dz)/denom));double x=p.X-a.X-t*dx,z=p.Z-a.Z-t*dz,d=x*x+z*z;if(d>best){best=d;pick=i;}}
            if(pick>=0&&best>.5625){Simplify(input,first,pick,output);output.RemoveAt(output.Count-1);Simplify(input,pick,last,output);}else{output.Add(a);output.Add(b);}
        }
        public static RouteDocument Build(System.Collections.Generic.List<RouteNode> samples,float defaultHeight=2,float width=2)
        {
            if(samples==null||samples.Count<2||samples.Count>2048)throw new ArgumentException("连续输入需2—2048个有限采样点。");
            if(float.IsNaN(defaultHeight)||float.IsInfinity(defaultHeight)||defaultHeight<0||defaultHeight>8||Math.Abs(defaultHeight/.25f-Math.Round(defaultHeight/.25f))>.0001)throw new ArgumentException("初始标高须为0—8m的0.25m步长。");
            foreach(var n in samples)if(n==null||float.IsNaN(n.X)||float.IsNaN(n.Z)||float.IsInfinity(n.X)||float.IsInfinity(n.Z))throw new ArgumentException("采样坐标必须有限。");
            var reduced=new System.Collections.Generic.List<RouteNode>();Simplify(samples,0,samples.Count-1,reduced);
            var poly=new System.Collections.Generic.List<RouteNode>();Add(poly,Point(Snap(reduced[0].X,.5f),defaultHeight,Snap(reduced[0].Z,.5f)));
            for(int i=1;i<reduced.Count;i++)
            {
                var last=poly[poly.Count-1];float x=Snap(reduced[i].X,.5f),z=Snap(reduced[i].Z,.5f);
                if(Math.Abs(x-last.X)>=Math.Abs(z-last.Z)){Add(poly,Point(x,defaultHeight,last.Z));Add(poly,Point(x,defaultHeight,z));}
                else{Add(poly,Point(last.X,defaultHeight,z));Add(poly,Point(x,defaultHeight,z));}
            }
            if(poly.Count<2)throw new ArgumentException("路线过短，请继续拖画。");
            var doc=new RouteDocument{Width=width};float run=defaultHeight*2;
            if(defaultHeight>0)
            {
                if(poly.Count==2&&Distance(poly[0],poly[1])<run*2+1)throw new ArgumentException("路线需要两端台阶和至少1m平台，请加长或降低初始标高。");
                if(poly.Count>2&&(Distance(poly[0],poly[1])<run+width/2+.5f||Distance(poly[poly.Count-2],poly[poly.Count-1])<run+width/2+.5f))throw new ArgumentException("首尾直段需容纳台阶和转角平台，请延长首尾直段。");
                var a=poly[0];var b=poly[1];doc.Nodes.Add(Point(a.X,0,a.Z));doc.Nodes.Add(Point(a.X+Math.Sign(b.X-a.X)*run,defaultHeight,a.Z+Math.Sign(b.Z-a.Z)*run));
                for(int i=1;i<poly.Count-1;i++)doc.Nodes.Add(poly[i].Clone());
                var end=poly[poly.Count-1];var before=poly[poly.Count-2];doc.Nodes.Add(Point(end.X-Math.Sign(end.X-before.X)*run,defaultHeight,end.Z-Math.Sign(end.Z-before.Z)*run));doc.Nodes.Add(Point(end.X,0,end.Z));
            }
            else foreach(var n in poly)doc.Nodes.Add(n.Clone());
            for(int i=0;i<doc.Nodes.Count;i++)doc.Nodes[i].Id="n"+i;
            var solved=RouteSolver.Solve(doc);if(!solved.Valid)throw new ArgumentException(solved.Message);
            RouteSegment widest=null;foreach(var s in solved.Segments)if(s.StartHeight==s.EndHeight&&s.StartHeight>=1.25f&&s.Length>=3&&(widest==null||s.Length>widest.Length))widest=s;
            if(widest!=null)doc.Openings.Add(new RouteOpening{SegmentId=widest.Id,Width=Math.Min(4,Snap(widest.Length-1,.5f)),Height=Math.Min(1.25f,widest.StartHeight-.75f)});
            solved=RouteSolver.Solve(doc);if(!solved.Valid)throw new ArgumentException(solved.Message);return doc;
        }
    }
}
