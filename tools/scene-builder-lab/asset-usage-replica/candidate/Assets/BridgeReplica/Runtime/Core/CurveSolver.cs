using System;
using System.Collections.Generic;
using XingHai.SB03;

namespace XingHai.BridgeReplica
{
    public static class CurveSolver
    {
        const float E=.00001f,Spacing=.25f;
        static bool Finite(float n){return !float.IsNaN(n)&&!float.IsInfinity(n);}
        static float Length(float x,float z){return (float)Math.Sqrt(x*x+z*z);}
        static CurveResult Reject(string message){return new CurveResult{Message=message};}
        public static CurveResult Solve(RouteDocument source)
        {
            if(source==null||source.SchemaVersion!=2)return Reject("自由路线需要版本2；旧版本线路继续由原求解器读取。");
            if(string.IsNullOrWhiteSpace(source.Id)||string.IsNullOrWhiteSpace(source.KitId)||string.IsNullOrWhiteSpace(source.KitVersion))return Reject("路线及素材版本身份不能为空。");
            if(!Finite(source.Width)||source.Width<.5f||source.Width>6)return Reject("桥面净宽支持0.5—6米。");
            if(source.Nodes==null||source.Nodes.Count<2||source.Nodes.Count>4096||source.Openings==null)return Reject("自由路线需要2—4096个有限控制点与有效开口列表。");
            var ids=new HashSet<string>();
            foreach(var p in source.Nodes)
            {
                if(p==null||string.IsNullOrWhiteSpace(p.Id)||p.Id.Contains("__")||!ids.Add(p.Id))return Reject("每个控制点需要唯一、稳定且不含双下划线的身份。");
                if(!Finite(p.X)||!Finite(p.Y)||!Finite(p.Z)||Math.Abs(p.X)>512||Math.Abs(p.Z)>512||p.Y<0||p.Y>8)return Reject("控制点必须有限，水平范围±512米、标高0—8米。");
            }
            var doc=source.Clone();var result=new CurveResult{Document=doc};
            float arc=0;
            for(int i=0;i<doc.Nodes.Count-1;i++)
            {
                var a=doc.Nodes[i];var b=doc.Nodes[i+1];float dx=b.X-a.X,dz=b.Z-a.Z,length=Length(dx,dz);
                if(length<.005f)return Reject("控制点"+a.Id+"与"+b.Id+"过近；请保留明确走向。");
                if(Math.Abs(b.Y-a.Y)>length*.5f+.0001f)return Reject("路段"+a.Id+"→"+b.Id+"过陡，每0.25米步高至少需0.5米进深。");
                result.Spans.Add(new CurveSpan{Id=RouteDocument.GetSegmentId(a.Id,b.Id),Index=i,StartNodeId=a.Id,EndNodeId=b.Id,StartArc=arc,EndArc=arc+length,Length=length,StartHeight=a.Y,EndHeight=b.Y,TangentX=dx/length,TangentZ=dz/length});
                arc+=length;
            }
            if(arc<.5f||arc>256)return Reject("本轮自由路线总长支持0.5—256米。");
            result.Length=arc;
            // Height cuts can add collinear author nodes very close to a turn.
            // They do not add a new planar corner or change its design radius.
            var corners=new List<int>{0};
            for(int i=1;i<doc.Nodes.Count-1;i++)
            {
                var a=result.Spans[i-1];var b=result.Spans[i];
                if(Math.Abs(a.TangentX*b.TangentZ-a.TangentZ*b.TangentX)>E||a.TangentX*b.TangentX+a.TangentZ*b.TangentZ<0)corners.Add(i);
            }
            corners.Add(doc.Nodes.Count-1);
            for(int i=1;i<result.Spans.Count;i++)
            {
                var before=result.Spans[i-1];var after=result.Spans[i];
                float dot=before.TangentX*after.TangentX+before.TangentZ*after.TangentZ;
                if(dot<.6427876f)return Reject("控制点"+doc.Nodes[i].Id+"转向过急（超过50度）；请绘制可见的缓弯，系统不会代换成直角平台。");
                float cross=Math.Abs(before.TangentX*after.TangentZ-before.TangentZ*after.TangentX);
                if(cross>E)
                {
                    int corner=corners.IndexOf(i);var previous=doc.Nodes[corners[corner-1]];var next=doc.Nodes[corners[corner+1]];
                    float chord=Length(next.X-previous.X,next.Z-previous.Z);
                    float radius=chord/(2*cross);
                    if(radius<doc.Width*1.2f)return Reject("控制点"+doc.Nodes[i].Id+"内侧空间不足；局部估算半径小于净宽的1.2倍。");
                }
            }
            for(int i=0;i<result.Spans.Count;i++)for(int j=i+2;j<result.Spans.Count;j++)
            {
                var a=doc.Nodes[i];var b=doc.Nodes[i+1];var c=doc.Nodes[j];var d=doc.Nodes[j+1];
                if(Intersects(a.X,a.Z,b.X,b.Z,c.X,c.Z,d.X,d.Z))return Reject("路线自交或折回："+result.Spans[i].Id+" / "+result.Spans[j].Id+"。");
            }
            for(int s=0;s<result.Spans.Count;s++)
            {
                var span=result.Spans[s];var a=doc.Nodes[s];var b=doc.Nodes[s+1];int steps=Math.Max(1,(int)Math.Ceiling(span.Length/Spacing));
                for(int k=s==0?0:1;k<=steps;k++)
                {
                    float t=(float)k/steps;
                    result.Frames.Add(new CurveFrame{X=a.X+(b.X-a.X)*t,Y=a.Y+(b.Y-a.Y)*t,Z=a.Z+(b.Z-a.Z)*t,Arc=span.StartArc+span.Length*t,SpanIndex=s});
                }
            }
            // First construct the actual polygon's miter at geometric author
            // corners. Offsetting every densely sampled centre station and only
            // moving the corner station makes the inner edge double back on
            // itself whenever that station is closer than the miter extension.
            var offsetX=new float[doc.Nodes.Count];var offsetZ=new float[doc.Nodes.Count];
            foreach(int node in corners)
            {
                var before=result.Spans[Math.Max(0,node-1)];var after=result.Spans[Math.Min(result.Spans.Count-1,node)];
                float tx=before.TangentX+after.TangentX,tz=before.TangentZ+after.TangentZ,len=Length(tx,tz);
                float nx=-tz/len,nz=tx/len,miter=doc.Width*.5f/Math.Max(.25f,nx*(-before.TangentZ)+nz*before.TangentX);
                offsetX[node]=nx*miter;offsetZ[node]=nz*miter;
            }
            for(int c=0;c<corners.Count-1;c++)
            {
                int first=corners[c],last=corners[c+1];float start=first==0?0:result.Spans[first-1].EndArc,end=result.Spans[last-1].EndArc;
                for(int n=first+1;n<last;n++)
                {
                    float t=(result.Spans[n-1].EndArc-start)/(end-start);
                    offsetX[n]=offsetX[first]+(offsetX[last]-offsetX[first])*t;offsetZ[n]=offsetZ[first]+(offsetZ[last]-offsetZ[first])*t;
                }
            }
            for(int i=0;i<result.Frames.Count;i++)
            {
                var f=result.Frames[i];float inX,outX,inZ,outZ;
                if(i>0){var p=result.Frames[i-1];float len=Length(f.X-p.X,f.Z-p.Z);inX=(f.X-p.X)/len;inZ=(f.Z-p.Z)/len;}
                else{inX=result.Spans[0].TangentX;inZ=result.Spans[0].TangentZ;}
                if(i<result.Frames.Count-1){var p=result.Frames[i+1];float len=Length(p.X-f.X,p.Z-f.Z);outX=(p.X-f.X)/len;outZ=(p.Z-f.Z)/len;}
                else{outX=inX;outZ=inZ;}
                float sum=Length(inX+outX,inZ+outZ);f.TangentX=(inX+outX)/sum;f.TangentZ=(inZ+outZ)/sum;f.NormalX=-f.TangentZ;f.NormalZ=f.TangentX;
                var span=result.Spans[f.SpanIndex];float along=(f.Arc-span.StartArc)/span.Length;
                float ox=offsetX[span.Index]+(offsetX[span.Index+1]-offsetX[span.Index])*along,oz=offsetZ[span.Index]+(offsetZ[span.Index+1]-offsetZ[span.Index])*along;
                f.LeftX=f.X+ox;f.LeftZ=f.Z+oz;f.RightX=f.X-ox;f.RightZ=f.Z-oz;
                if(i>0){var p=result.Frames[i-1];f.LeftArc=p.LeftArc+Length(f.LeftX-p.LeftX,f.LeftZ-p.LeftZ);f.RightArc=p.RightArc+Length(f.RightX-p.RightX,f.RightZ-p.RightZ);}
            }
            // Validate actual offset boundaries, not only the center polyline.
            for(int i=0;i<result.Frames.Count-1;i++)for(int j=i+2;j<result.Frames.Count-1;j++)
            {
                var a=result.Frames[i];var b=result.Frames[i+1];var c=result.Frames[j];var d=result.Frames[j+1];
                if(Intersects(a.LeftX,a.LeftZ,b.LeftX,b.LeftZ,c.LeftX,c.LeftZ,d.LeftX,d.LeftZ)||Intersects(a.RightX,a.RightZ,b.RightX,b.RightZ,c.RightX,c.RightZ,d.RightX,d.RightZ))return Reject("偏移边界在约"+a.Arc.ToString("0.0")+"米与"+c.Arc.ToString("0.0")+"米处相交；请扩大该局部弯道。");
                if(c.Arc-b.Arc>doc.Width*2&&SegmentDistance(a.X,a.Z,b.X,b.Z,c.X,c.Z,d.X,d.Z)<doc.Width+.05f)return Reject("两段桥面在约"+a.Arc.ToString("0.0")+"米与"+c.Arc.ToString("0.0")+"米处过近；本轮不自动焊接交叉网。");
            }
            var openingIds=new HashSet<string>();
            foreach(var opening in doc.Openings)
            {
                if(opening==null||string.IsNullOrWhiteSpace(opening.SegmentId)||!openingIds.Add(opening.SegmentId))return Reject("开口必须唯一关联一个仍存在的作者路段。");
                var span=result.Spans.Find(p=>p.Id==opening.SegmentId);if(span==null)return Reject("开口关联路段已不存在："+opening.SegmentId+"。");
                if(!opening.Enabled)continue;
                if(!Finite(opening.Width)||!Finite(opening.Height))return Reject("开口尺寸必须有限。");
                if(Math.Abs(span.StartHeight-span.EndHeight)>E)return Reject("拱洞只支持明确的水平作者直段："+span.Id+"。");
                var plan=BridgeSolver.Solve(new BridgeSpec{Id=doc.Id+"/"+span.Id,Length=span.Length,Width=doc.Width,DeckHeight=span.StartHeight,StartHeight=span.StartHeight,EndHeight=span.EndHeight,Rails=false,Opening=true,ArchWidth=opening.Width,ArchHeight=opening.Height});
                if(!plan.Valid)return Reject("直段拱洞"+span.Id+"："+plan.Message);
                span.HasOpening=true;result.Openings.Add(new CurveOpening{SegmentId=span.Id,SpanStartArc=span.StartArc,StartArc=span.StartArc+plan.OpeningMinX,EndArc=span.StartArc+plan.OpeningMaxX,Plan=plan});
            }
            result.Valid=true;result.Message="自由路线有效："+doc.Nodes.Count+"控制点，"+result.Length.ToString("0.0")+"米；中心线保持输入走向。";return result;
        }
        static float Cross(float ax,float az,float bx,float bz,float cx,float cz){return (bx-ax)*(cz-az)-(bz-az)*(cx-ax);}
        static bool On(float ax,float az,float bx,float bz,float px,float pz){return Math.Abs(Cross(ax,az,bx,bz,px,pz))<E&&px>=Math.Min(ax,bx)-E&&px<=Math.Max(ax,bx)+E&&pz>=Math.Min(az,bz)-E&&pz<=Math.Max(az,bz)+E;}
        static bool Intersects(float ax,float az,float bx,float bz,float cx,float cz,float dx,float dz)
        {
            float c=Cross(ax,az,bx,bz,cx,cz),d=Cross(ax,az,bx,bz,dx,dz),a=Cross(cx,cz,dx,dz,ax,az),b=Cross(cx,cz,dx,dz,bx,bz);
            if(((c>E&&d<-E)||(c<-E&&d>E))&&((a>E&&b<-E)||(a<-E&&b>E)))return true;
            return On(ax,az,bx,bz,cx,cz)||On(ax,az,bx,bz,dx,dz)||On(cx,cz,dx,dz,ax,az)||On(cx,cz,dx,dz,bx,bz);
        }
        static float PointDistance(float px,float pz,float ax,float az,float bx,float bz)
        {float dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;float t=l<E?0:Math.Max(0,Math.Min(1,((px-ax)*dx+(pz-az)*dz)/l));return Length(px-ax-dx*t,pz-az-dz*t);}
        static float SegmentDistance(float ax,float az,float bx,float bz,float cx,float cz,float dx,float dz)
        {return Math.Min(Math.Min(PointDistance(ax,az,cx,cz,dx,dz),PointDistance(bx,bz,cx,cz,dx,dz)),Math.Min(PointDistance(cx,cz,ax,az,bx,bz),PointDistance(dx,dz,ax,az,bx,bz)));}
    }
}
