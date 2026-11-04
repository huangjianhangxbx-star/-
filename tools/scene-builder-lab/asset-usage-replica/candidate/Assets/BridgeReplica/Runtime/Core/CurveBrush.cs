using System;
using System.Collections.Generic;

namespace XingHai.BridgeReplica
{
    // Optional DESIGN rounding for a new gesture. This is separate from the
    // strict sketch's 0.08m noise envelope: a wide corner can depart metres
    // from the raw pointed gesture. Saved authors never enter this module.
    public static class CurveBrush
    {
        const float E=.00001f;
        sealed class Corner
        {
            public float Arc,Distance,Radius,Angle,Sign,CenterX,CenterZ,StartAngle;
            public RouteNode Enter,Exit;
        }
        static bool Finite(float value){return !float.IsNaN(value)&&!float.IsInfinity(value);}
        static float Distance(RouteNode a,RouteNode b)
        {double x=(double)b.X-a.X,z=(double)b.Z-a.Z;return (float)Math.Sqrt(x*x+z*z);}
        static float Cross(RouteNode a,RouteNode b,RouteNode c)
        {return (b.X-a.X)*(c.Z-a.Z)-(b.Z-a.Z)*(c.X-a.X);}
        static bool On(RouteNode a,RouteNode b,RouteNode p)
        {return Math.Abs(Cross(a,b,p))<=E&&p.X>=Math.Min(a.X,b.X)-E&&p.X<=Math.Max(a.X,b.X)+E&&p.Z>=Math.Min(a.Z,b.Z)-E&&p.Z<=Math.Max(a.Z,b.Z)+E;}
        static bool Intersects(RouteNode a,RouteNode b,RouteNode c,RouteNode d)
        {
            float x=Cross(a,b,c),y=Cross(a,b,d),u=Cross(c,d,a),v=Cross(c,d,b);
            return (((x>E&&y<-E)||(x<-E&&y>E))&&((u>E&&v<-E)||(u<-E&&v>E)))||On(a,b,c)||On(a,b,d)||On(c,d,a)||On(c,d,b);
        }
        static float PointDistance(RouteNode p,RouteNode a,RouteNode b)
        {
            float dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz;
            float t=den<1e-12f?0:Math.Max(0,Math.Min(1,((p.X-a.X)*dx+(p.Z-a.Z)*dz)/den));
            float x=p.X-a.X-dx*t,z=p.Z-a.Z-dz*t;return (float)Math.Sqrt(x*x+z*z);
        }
        static List<RouteNode> Clean(List<RouteNode> samples)
        {
            var result=new List<RouteNode>();
            foreach(var p in samples)
            {
                if(p==null||!Finite(p.X)||!Finite(p.Z))throw new ArgumentException("笔迹坐标必须有限。");
                if(result.Count==0||result[result.Count-1].X!=p.X||result[result.Count-1].Z!=p.Z)result.Add(p.Clone());
            }
            return result;
        }
        static void RawSafety(List<RouteNode> raw)
        {
            for(int i=1;i<raw.Count-1;i++)
            {
                float a=Distance(raw[i-1],raw[i]),b=Distance(raw[i],raw[i+1]);if(a<E||b<E)continue;
                float dot=((raw[i].X-raw[i-1].X)*(raw[i+1].X-raw[i].X)+(raw[i].Z-raw[i-1].Z)*(raw[i+1].Z-raw[i].Z))/(a*b);
                if(dot<-.9999f)throw new ArgumentException("笔迹出现原路折回；请回到有效端点后换个方向。");
            }
            for(int i=0;i<raw.Count-1;i++)for(int j=i+2;j<raw.Count-1;j++)
                if(Intersects(raw[i],raw[i+1],raw[j],raw[j+1]))throw new ArgumentException("原始笔迹自交或折回；当前范围不采用。");
        }
        static void Simplify(List<RouteNode> raw,int first,int last,float tolerance,List<int> selected)
        {
            float best=0;int pick=-1;
            for(int i=first+1;i<last;i++){float d=PointDistance(raw[i],raw[first],raw[last]);if(d>best){best=d;pick=i;}}
            if(pick>=0&&best>tolerance)
            {Simplify(raw,first,pick,tolerance,selected);selected.RemoveAt(selected.Count-1);Simplify(raw,pick,last,tolerance,selected);}
            else{selected.Add(first);selected.Add(last);}
        }
        static ArgumentException Space(string detail="")
        {return new ArgumentException("当前转角缺少按桥宽圆角的空间，请继续延长后再转弯。"+detail);}
        static RouteNode ArcPoint(Corner corner,float t)
        {
            if(t<=0)return corner.Enter.Clone();if(t>=1)return corner.Exit.Clone();
            double angle=corner.StartAngle+corner.Sign*corner.Angle*t;
            return new RouteNode{Id="design-arc",X=corner.CenterX+corner.Radius*(float)Math.Cos(angle),Z=corner.CenterZ+corner.Radius*(float)Math.Sin(angle)};
        }
        static void Add(List<RouteNode> path,RouteNode point)
        {if(path.Count==0||path[path.Count-1].X!=point.X||path[path.Count-1].Z!=point.Z)path.Add(point.Clone());}
        static List<RouteNode> Design(List<RouteNode> macro,float width,out List<Corner> corners)
        {
            corners=new List<Corner>();var path=new List<RouteNode>();Add(path,macro[0]);float arc=0;
            for(int i=1;i<macro.Count-1;i++)
            {
                var a=macro[i-1];var p=macro[i];var b=macro[i+1];float before=Distance(a,p),after=Distance(p,b);arc+=before;
                if(before<E||after<E)throw Space();
                float ux=(p.X-a.X)/before,uz=(p.Z-a.Z)/before,vx=(b.X-p.X)/after,vz=(b.Z-p.Z)/after;
                float dot=Math.Max(-1,Math.Min(1,ux*vx+uz*vz)),cross=ux*vz-uz*vx,angle=(float)Math.Acos(dot);
                if(angle<.01f){Add(path,p);continue;}
                if(dot<-.9999f)throw new ArgumentException("笔迹出现原路折回，不能用圆角掩盖。");
                float tangent=(float)Math.Tan(angle*.5f),radius=Math.Min(width,Math.Min(before,after)*.45f/tangent);
                if(!Finite(radius)||radius<width*.65f-E)
                {
                    float required=width*.65f*tangent/.45f;
                    throw Space("转角两侧至少各约"+required.ToString("0.0",System.Globalization.CultureInfo.InvariantCulture)+"米；当前前段"+before.ToString("0.0",System.Globalization.CultureInfo.InvariantCulture)+"米、后段"+after.ToString("0.0",System.Globalization.CultureInfo.InvariantCulture)+"米。");
                }
                float distance=radius*tangent,sign=cross>=0?1:-1;
                var corner=new Corner{Arc=arc,Distance=distance,Radius=radius,Angle=angle,Sign=sign,
                    Enter=new RouteNode{Id="design-entry",X=p.X-ux*distance,Z=p.Z-uz*distance},Exit=new RouteNode{Id="design-exit",X=p.X+vx*distance,Z=p.Z+vz*distance}};
                corner.CenterX=corner.Enter.X-uz*sign*radius;corner.CenterZ=corner.Enter.Z+ux*sign*radius;
                corner.StartAngle=(float)Math.Atan2(corner.Enter.Z-corner.CenterZ,corner.Enter.X-corner.CenterX);
                Add(path,corner.Enter);
                int count=Math.Max(1,(int)Math.Ceiling(Math.Max(radius*angle/.25f,angle/(Math.PI/12))));
                for(int k=1;k<=count;k++)Add(path,ArcPoint(corner,(float)k/count));
                corners.Add(corner);
            }
            Add(path,macro[macro.Count-1]);if(corners.Count==0)throw Space();return path;
        }
        static List<RouteNode> CloneKeys(List<RouteNode> keys)
        {return keys==null?null:keys.ConvertAll(p=>p==null?null:p.Clone());}
        static List<RouteNode> MapKeys(RouteDocument contour,List<RouteNode> macro,List<Corner> corners,List<RouteNode> keys,float macroTolerance)
        {
            if(keys==null)return null;
            var result=new List<RouteNode>();var original=new RouteDocument{Nodes=macro};float previous=-1;
            foreach(var key in keys)
            {
                if(key==null||!Finite(key.X)||!Finite(key.Z)||!Finite(key.Y))throw new ArgumentException("高度锚点必须有限。");
                float finalArc;RouteNode foot;var mapped=key.Clone();
                if(CurveGesture.Project(contour,key,out finalArc,out foot)>.1f+E)
                {
                    float oldArc;RouteNode oldFoot;
                    if(CurveGesture.Project(original,key,out oldArc,out oldFoot)>macroTolerance+.1f+E)throw new ArgumentException("高度锚点偏离原笔迹，不能自动映射圆角。");
                    RouteNode design=oldFoot;
                    foreach(var corner in corners)if(oldArc>=corner.Arc-corner.Distance-E&&oldArc<=corner.Arc+corner.Distance+E)
                    {design=ArcPoint(corner,Math.Max(0,Math.Min(1,(oldArc-(corner.Arc-corner.Distance))/(2*corner.Distance))));break;}
                    if(CurveGesture.Project(contour,design,out finalArc,out foot)>.1f+E)throw new ArgumentException("圆角高度锚点无法落在实际设计路径上。");
                    mapped.X=foot.X;mapped.Z=foot.Z;
                }
                if(finalArc<previous-E)throw new ArgumentException("高度锚点必须沿设计路径单调排列。");previous=finalArc;result.Add(mapped);
            }
            return result;
        }
        static bool Geometric(string message)
        {
            return message.Contains("转向过急")||message.Contains("内侧")||message.Contains("边界")||message.Contains("自交")||message.Contains("折回")||message.Contains("过近")||message.Contains("范围内拟合");
        }
        public static RouteDocument Build(List<RouteNode> samples,float defaultHeight,float width,List<RouteNode> heightKeys,out bool rounded,out List<RouteNode> mappedKeys,out string notice)
        {
            rounded=false;mappedKeys=null;notice="";RouteDocument contour;
            try{contour=CurveSketch.Build(samples,defaultHeight,width);}
            catch(ArgumentException e)
            {
                if(!Geometric(e.Message)||samples==null||samples.Count<2||samples.Count>4096||!Finite(width)||width<.5f||width>6)throw;
                var raw=Clean(samples);RawSafety(raw);
                // This scale-aware macro contour belongs to design rounding,
                // not to the unchanged strict mouse-noise tolerance.
                float tolerance=Math.Max(.08f,Math.Min(.25f,width*.08f));var selected=new List<int>();Simplify(raw,0,raw.Count-1,tolerance,selected);
                var macro=new List<RouteNode>();foreach(int index in selected)macro.Add(raw[index].Clone());
                // Design rounding answers a genuine sharp intent, rather than
                // widening the ordinary noise budget on every small rejected
                // update of an already smooth hand-drawn curve.
                bool sharp=false;
                for(int i=1;i<macro.Count-1;i++)
                {
                    var a=macro[i-1];var p=macro[i];var b=macro[i+1];float u=Distance(a,p),v=Distance(p,b);
                    if(u>E&&v>E&&((p.X-a.X)*(b.X-p.X)+(p.Z-a.Z)*(b.Z-p.Z))/(u*v)<.173648f){sharp=true;break;}
                }
                if(!sharp)throw;
                List<Corner> corners;var design=Design(macro,width,out corners);
                try{contour=CurveSketch.Build(design,defaultHeight,width);}catch(ArgumentException failure){throw Space(failure.Message);}
                mappedKeys=MapKeys(contour,macro,corners,heightKeys,tolerance);
                // Height failures are not permission to keep changing the XY
                // design or to relax the slope/geometry solver.
                if(heightKeys!=null)contour=CurveGesture.ApplyHeightProfile(contour,mappedKeys);
                rounded=true;notice="已按桥宽自动圆角；圆弧会适当偏离鼠标尖角。";return contour;
            }
            mappedKeys=CloneKeys(heightKeys);
            // A successful strict sketch is returned byte-for-byte unless the
            // caller explicitly requested a height profile. Never round to
            // conceal an invalid height profile on already valid XY geometry.
            if(heightKeys!=null)contour=CurveGesture.ApplyHeightProfile(contour,mappedKeys);
            return contour;
        }
    }
}
