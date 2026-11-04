using System;
using System.Collections.Generic;

namespace XingHai.BridgeReplica
{
    public static class CurveSketch
    {
        const float Tolerance=.035f,MaximumDeviation=.08f,StableSpacing=.5f;
        static float Distance(RouteNode a,RouteNode b){float x=b.X-a.X,z=b.Z-a.Z;return (float)Math.Sqrt(x*x+z*z);}
        static bool Finite(float n){return !float.IsNaN(n)&&!float.IsInfinity(n);}
        static float DistanceToSegment(RouteNode p,RouteNode a,RouteNode b)
        {
            float dx=b.X-a.X,dz=b.Z-a.Z,denom=dx*dx+dz*dz,t=denom<.0000001f?0:Math.Max(0,Math.Min(1,((p.X-a.X)*dx+(p.Z-a.Z)*dz)/denom));
            float x=p.X-a.X-dx*t,z=p.Z-a.Z-dz*t;return (float)Math.Sqrt(x*x+z*z);
        }
        static void Stabilize(List<RouteNode> input,List<RouteNode> reference,List<int> selected,float width)
        {
            // Pointer jitter must not become sub-centimetre design corners.
            // Remove a short control only when the entire affected raw interval
            // still lies inside the declared error budget. First and final real
            // input points are never moved, filtered or extrapolated.
            bool changed=true;
            while(changed)
            {
                changed=false;
                for(int i=1;i<selected.Count-1;i++)
                {
                    int a=selected[i-1],p=selected[i],b=selected[i+1];
                    float before=Distance(input[a],input[p]),after=Distance(input[p],input[b]);
                    float ax=(input[p].X-input[a].X)/before,az=(input[p].Z-input[a].Z)/before,bx=(input[b].X-input[p].X)/after,bz=(input[b].Z-input[p].Z)/after;
                    float cross=Math.Abs(ax*bz-az*bx),dot=ax*bx+az*bz;
                    // A noisy control just beyond the spacing cutoff can still
                    // create an impossible local corner. Repair that input only
                    // inside the same raw-interval deviation budget; the final
                    // solver continues to enforce the physical constraints.
                    bool unstable=Math.Min(before,after)<StableSpacing||dot<.6427876f||(cross>.00001f&&Distance(input[a],input[b])/(2*cross)<width*1.2f);
                    if(!unstable)continue;
                    bool allowed=true;for(int k=a;k<=b;k++)if(DistanceToSegment(reference[k],input[a],input[b])>MaximumDeviation){allowed=false;break;}
                    if(!allowed)continue;selected.RemoveAt(i);changed=true;break;
                }
            }
        }
        static void Simplify(List<RouteNode> input,int first,int last,List<int> output,float tolerance)
        {
            var a=input[first];var b=input[last];float dx=b.X-a.X,dz=b.Z-a.Z,denom=dx*dx+dz*dz,best=0;int pick=-1;
            for(int i=first+1;i<last;i++)
            {var p=input[i];float t=denom<.0000001f?0:Math.Max(0,Math.Min(1,((p.X-a.X)*dx+(p.Z-a.Z)*dz)/denom));float x=p.X-a.X-t*dx,z=p.Z-a.Z-t*dz,d=x*x+z*z;if(d>best){best=d;pick=i;}}
            if(pick>=0&&best>tolerance*tolerance){Simplify(input,first,pick,output,tolerance);output.RemoveAt(output.Count-1);Simplify(input,pick,last,output,tolerance);}else{output.Add(first);output.Add(last);}
        }
        static bool WithinEnvelope(List<RouteNode> reference,List<RouteNode> fit,List<int> selected)
        {
            for(int i=1;i<selected.Count;i++)
            {
                int first=selected[i-1],last=selected[i];var a=fit[first];var b=fit[last];float dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz;
                float min=float.MaxValue,max=float.MinValue;int minimum=first,maximum=first;
                for(int k=first;k<=last;k++)
                {
                    if(DistanceToSegment(reference[k],a,b)>MaximumDeviation)return false;
                    float u=den<.0000001f?0:((reference[k].X-a.X)*dx+(reference[k].Z-a.Z)*dz)/den;
                    if(u<min){min=u;minimum=k;}if(u>max){max=u;maximum=k;}
                }
                // The connected raw interval covers every projection between
                // its extrema. Its distance to this segment is bounded above,
                // so all covered segment points are also <=0.08m from raw.
                // Explicit end checks cover any uncovered projection tails.
                if(min>0&&Distance(a,reference[minimum])>MaximumDeviation)return false;
                if(max<1&&Distance(b,reference[maximum])>MaximumDeviation)return false;
            }
            return true;
        }
        static List<RouteNode> FitNeighbourhood(List<RouteNode> input,float radius)
        {
            var arc=new double[input.Count];for(int i=1;i<input.Count;i++)arc[i]=arc[i-1]+Distance(input[i-1],input[i]);
            var fit=new List<RouteNode>();int left=0,right=0;
            for(int i=0;i<input.Count;i++)
            {
                var node=input[i].Clone();
                if(i!=0&&i!=input.Count-1)
                {
                    while(left<i&&arc[i]-arc[left]>=radius)left++;if(right<i)right=i;while(right+1<input.Count&&arc[right+1]-arc[i]<radius)right++;
                    double w=0,u=0,uu=0,x=0,z=0,ux=0,uz=0;
                    for(int j=left;j<=right;j++)
                    {
                        double distance=arc[j]-arc[i],coverage=((j==0?arc[1]-arc[0]:arc[j]-arc[j-1])+(j==input.Count-1?arc[j]-arc[j-1]:arc[j+1]-arc[j]))*.5;
                        double weight=Math.Max(0,1-Math.Abs(distance)/radius)*coverage,px=input[j].X-node.X,pz=input[j].Z-node.Z;
                        w+=weight;u+=weight*distance;uu+=weight*distance*distance;x+=weight*px;z+=weight*pz;ux+=weight*distance*px;uz+=weight*distance*pz;
                    }
                    double determinant=w*uu-u*u;
                    if(determinant>1e-10){node.X+=(float)((x*uu-ux*u)/determinant);node.Z+=(float)((z*uu-uz*u)/determinant);}
                }
                fit.Add(node);
            }
            return fit;
        }
        public static RouteDocument Build(List<RouteNode> samples,float defaultHeight=2,float width=2)
        {
            if(samples==null||samples.Count<2||samples.Count>4096)throw new ArgumentException("自由笔迹需要2—4096个采样点。");
            if(!Finite(defaultHeight)||defaultHeight<0||defaultHeight>8)throw new ArgumentException("新路线默认高度须为0—8米。");
            var clean=new List<RouteNode>();
            foreach(var p in samples)
            {
                if(p==null||!Finite(p.X)||!Finite(p.Z))throw new ArgumentException("笔迹坐标必须有限。");
                // Keep every distinct raw point, including a tiny final release
                // movement. Simplification owns the bounded noise removal.
                if(clean.Count==0||clean[clean.Count-1].X!=p.X||clean[clean.Count-1].Z!=p.Z)clean.Add(p.Clone());
            }
            if(clean.Count<2)throw new ArgumentException("笔迹过短，请继续绘制。");
            var primary=Construct(clean,clean,defaultHeight,width,Tolerance);var solved=CurveSolver.Solve(primary);if(solved.Valid)return primary;
            // Keep an already successful sketch byte-for-byte. Only rejected
            // new input may try a locally centred fit, and both fidelity and
            // the complete unchanged structural solver must accept the result.
            if(clean.Count>2&&Finite(width)&&width>=.5f&&width<=6)
            foreach(float radius in new[]{StableSpacing*.5f,StableSpacing,StableSpacing*1.5f})
            {
                try{var fit=FitNeighbourhood(clean,radius);var candidate=Construct(fit,clean,defaultHeight,width,.015f);if(CurveSolver.Solve(candidate).Valid)return candidate;}
                catch(ArgumentException){/* Keep the original rejection if all bounded fits fail. */}
            }
            throw new ArgumentException(solved.Message);
        }
        static RouteDocument Construct(List<RouteNode> geometry,List<RouteNode> reference,float defaultHeight,float width,float tolerance)
        {
            var selected=new List<int>();Simplify(geometry,0,geometry.Count-1,selected,tolerance);Stabilize(geometry,reference,selected,width);
            if(!WithinEnvelope(reference,geometry,selected))throw new ArgumentException("无法在原始笔迹0.08米范围内拟合；当前范围不采用。");
            var poly=new List<RouteNode>();foreach(int i in selected)poly.Add(new RouteNode{Id="stroke-"+i,X=geometry[i].X,Z=geometry[i].Z});
            var arcs=new List<float>{0};for(int i=1;i<poly.Count;i++)arcs.Add(arcs[i-1]+Distance(poly[i-1],poly[i]));float length=arcs[arcs.Count-1];
            if(length<.5f)throw new ArgumentException("继续绘制至至少0.5米，桥体就会出现。");
            // Only new strokes acquire automatic approaches. A saved author's
            // geometry is never silently rescaled when it is edited or reopened.
            float height=Math.Min(defaultHeight,(float)Math.Floor(Math.Max(0,(length-.5f)/4)/.25f)*.25f);
            var cuts=new List<float>(arcs);if(height>0){Insert(cuts,height*2);Insert(cuts,length-height*2);}cuts.Sort();
            var doc=new RouteDocument{SchemaVersion=2,Id="curve-stroke",Width=width,KitId="workshop.bridge.A",KitVersion="1",SimplifyTolerance=MaximumDeviation};
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
            return doc;
        }
        static void Insert(List<float> list,float value){if(!list.Exists(a=>Math.Abs(a-value)<.01f))list.Add(value);}
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
        public static RouteDocument PrependStroke(RouteDocument doc,List<RouteNode> stroke)
        {
            if(stroke==null||stroke.Count<2)throw new ArgumentException("续画至少需要两个实际采样点。");
            var r=doc.Clone();var first=r.Nodes[0];
            if(Math.Sqrt(Math.Pow(stroke[0].X-first.X,2)+Math.Pow(stroke[0].Z-first.Z,2))>.1)throw new ArgumentException("前端续画必须从当前路线首端开始。");
            var prefix=new List<RouteNode>();for(int i=stroke.Count-1;i>0;i--){var n=stroke[i].Clone();n.Id=Guid.NewGuid().ToString("N");prefix.Add(n);}
            r.Nodes.InsertRange(0,prefix);return r;
        }
        public static RouteDocument RemoveLast(RouteDocument doc)
        {
            if(doc==null||doc.Nodes.Count<=2)throw new ArgumentException("至少保留两个路线控制点。");
            var r=doc.Clone();string id=RouteDocument.GetSegmentId(r.Nodes[r.Nodes.Count-2].Id,r.Nodes[r.Nodes.Count-1].Id);r.Nodes.RemoveAt(r.Nodes.Count-1);r.Openings.RemoveAll(o=>o.SegmentId==id);return r;
        }
    }
}
