using System;
using System.Collections.Generic;
using System.Linq;
using XingHai.SB03;
namespace XingHai.BridgeReplica
{
    public static class RouteSolver
    {
        const float E=.0001f;
        static bool Finite(float n){return !float.IsNaN(n)&&!float.IsInfinity(n);}
        static bool Grid(float n,float q){return Math.Abs(n/q-Math.Round(n/q))<E;}
        static RouteResult Reject(string message){return new RouteResult{Message=message};}
        public static string GetSegmentId(string a,string b){return RouteDocument.GetSegmentId(a,b);}
        public static RouteResult Solve(RouteDocument source)
        {
            if(source==null||source.SchemaVersion!=1)return Reject("需要schemaVersion=1的线路作者。");
            if(string.IsNullOrWhiteSpace(source.Id)||source.Id.Length>80||string.IsNullOrWhiteSpace(source.KitId)||string.IsNullOrWhiteSpace(source.KitVersion))return Reject("线路与套件版本身份不能为空。");
            if(!Finite(source.Width)||source.Width<1||source.Width>6||!Grid(source.Width,1))return Reject("本接口族铺面宽1—6m，按1m递增；不支持改变源件尺寸。");
            if(source.Nodes==null||source.Nodes.Count<2||source.Nodes.Count>32||source.Openings==null)return Reject("线路需要2—32个节点和有效开口列表。");
            var ids=new HashSet<string>(StringComparer.Ordinal);
            foreach(var n in source.Nodes)
            {
                if(n==null||string.IsNullOrWhiteSpace(n.Id)||n.Id.Length>48||n.Id.Contains("__")||!ids.Add(n.Id))return Reject("节点身份须唯一、1—48字符，且不能包含双下划线。");
                if(!Finite(n.X)||!Finite(n.Y)||!Finite(n.Z)||Math.Abs(n.X)>128||Math.Abs(n.Z)>128||n.Y<0||n.Y>8||!Grid(n.X,.5f)||!Grid(n.Z,.5f)||!Grid(n.Y,.25f))return Reject("节点须落在水平0.5m／标高0.25m接口格内；标高0—8m，水平范围±128m。");
            }
            var doc=source.Clone();int count=doc.Nodes.Count-1;var dx=new float[count];var dz=new float[count];var lengths=new float[count];var turns=new bool[count+1];float total=0;
            for(int i=0;i<count;i++)
            {
                var a=doc.Nodes[i];var b=doc.Nodes[i+1];float x=b.X-a.X,z=b.Z-a.Z;
                if((Math.Abs(x)>E&&Math.Abs(z)>E)||(Math.Abs(x)<E&&Math.Abs(z)<E))return Reject("路段"+GetSegmentId(a.Id,b.Id)+"须为非零的X/Z轴向直线；转弯请保留独立平台节点。");
                lengths[i]=Math.Abs(x)+Math.Abs(z);if(lengths[i]>40)return Reject("单路段最长40m；请添加明确节点。");
                dx[i]=Math.Sign(x);dz[i]=Math.Sign(z);total+=lengths[i];
                if(i>0){float dot=dx[i-1]*dx[i]+dz[i-1]*dz[i];if(dot<-.5f)return Reject("线路不能在同一点折返180度。");turns[i]=Math.Abs(dot)<.5f;}
            }
            if(total>180)return Reject("本切片线路总长上限180m。");
            var existing=new HashSet<string>();for(int i=0;i<count;i++)existing.Add(GetSegmentId(doc.Nodes[i].Id,doc.Nodes[i+1].Id));
            var openingIds=new HashSet<string>(StringComparer.Ordinal);
            foreach(var o in doc.Openings)
            {
                if(o==null||string.IsNullOrWhiteSpace(o.SegmentId)||!existing.Contains(o.SegmentId)||!openingIds.Add(o.SegmentId))return Reject("开口必须唯一关联当前存在的路段；删除路段时请一起删除对应开口。");
                if(!Finite(o.Width)||!Finite(o.Height))return Reject("开口尺寸必须是有限数字。");
            }
            var result=new RouteResult{Document=doc,Plan=new BridgePlan{Valid=true,Spec=new BridgeSpec{Id=doc.Id,Width=doc.Width,Length=total,DeckHeight=doc.Nodes.Max(n=>n.Y),Rails=doc.Rails,Opening=false}}};
            for(int i=0;i<count;i++)
            {
                var a=doc.Nodes[i];var b=doc.Nodes[i+1];float trimA=turns[i]?doc.Width*.5f:0,trimB=turns[i+1]?doc.Width*.5f:0;
                float run=lengths[i]-trimA-trimB;
                if(run<.5f-E||!Grid(run,.5f))return Reject("路段"+GetSegmentId(a.Id,b.Id)+"过短，转角需预留半个铺面宽度及至少0.5m直段。");
                if(Math.Abs(b.Y-a.Y)>.5f*run+E)return Reject("路段"+GetSegmentId(a.Id,b.Id)+"过陡：每0.25m步高至少需要0.5m有效进深。");
                var seg=new RouteSegment{Id=GetSegmentId(a.Id,b.Id),StartNodeId=a.Id,EndNodeId=b.Id,StartX=a.X+dx[i]*trimA,StartZ=a.Z+dz[i]*trimA,EndX=b.X-dx[i]*trimB,EndZ=b.Z-dz[i]*trimB,DirX=dx[i],DirZ=dz[i],Length=run,StartHeight=a.Y,EndHeight=b.Y,Yaw=dx[i]>0?0:dz[i]>0?270:dx[i]<0?180:90};
                var o=doc.Openings.FirstOrDefault(v=>v.Enabled&&v.SegmentId==seg.Id);
                if(o!=null)
                {
                    if(Math.Abs(a.Y-b.Y)>E)return Reject("开口仅支持水平直线路段："+seg.Id+"；请恢复两端同高，或关闭该段开口。");
                    var p=BridgeSolver.Solve(new BridgeSpec{Id=doc.Id+"/"+seg.Id,Length=run,Width=doc.Width,DeckHeight=a.Y,StartHeight=a.Y,EndHeight=b.Y,Rails=false,Opening=true,ArchWidth=o.Width,ArchHeight=o.Height});
                    if(!p.Valid)return Reject(seg.Id+"："+p.Message);seg.HasOpening=true;seg.OpeningPlan=p;seg.OpeningStart=p.OpeningMinX;seg.OpeningEnd=p.OpeningMaxX;seg.OpeningCrown=p.OpeningCrown;
                }
                result.Segments.Add(seg);
            }
            // Adjacent segments meet through declared landings. Nonadjacent
            // swept corridors may neither cross nor overlap in this family.
            for(int i=0;i<count;i++)for(int j=i+2;j<count;j++)
            {
                var a=result.Segments[i];var b=result.Segments[j];float h=doc.Width/2;
                float aminX=Math.Min(a.StartX,a.EndX)-(a.DirX==0?h:0),amaxX=Math.Max(a.StartX,a.EndX)+(a.DirX==0?h:0),aminZ=Math.Min(a.StartZ,a.EndZ)-(a.DirZ==0?h:0),amaxZ=Math.Max(a.StartZ,a.EndZ)+(a.DirZ==0?h:0);
                float bminX=Math.Min(b.StartX,b.EndX)-(b.DirX==0?h:0),bmaxX=Math.Max(b.StartX,b.EndX)+(b.DirX==0?h:0),bminZ=Math.Min(b.StartZ,b.EndZ)-(b.DirZ==0?h:0),bmaxZ=Math.Max(b.StartZ,b.EndZ)+(b.DirZ==0?h:0);
                // Keep the authored coping/post envelopes apart as well as the
                // paving. Two merely touching floor strips are not a certified
                // junction and must not silently merge their guards.
                aminX-=.25f;amaxX+=.25f;aminZ-=.25f;amaxZ+=.25f;bminX-=.25f;bmaxX+=.25f;bminZ-=.25f;bmaxZ+=.25f;
                if(Math.Min(amaxX,bmaxX)-Math.Max(aminX,bminX)>E&&Math.Min(amaxZ,bmaxZ)-Math.Max(aminZ,bminZ)>E)return Reject("非相邻路段相交或距离过近："+a.Id+" / "+b.Id+"。本轮不支持交叉网。");
            }
            foreach(var seg in result.Segments)BuildSegment(result,seg);
            for(int i=1;i<doc.Nodes.Count-1;i++)if(turns[i])BuildLanding(result,doc.Nodes[i]);
            BuildBoundary(result);
            if(result.Plan.Parts.Count>24000||result.Plan.Solids.Count>2048)return Reject("线路超出本切片24000构件／2048墙芯段预算。");
            result.Valid=true;result.Message="可生成：保留"+doc.Nodes.Count+"节点、"+count+"路段的折线结构。";return result;
        }
        static BridgePart Part(string id,string source,string role,float x,float y,float z,float yaw=0)
        {return new BridgePart{Id=id,SourceId="sb03."+source,Role=role,X=x,Y=y,Z=z,Yaw=yaw};}
        static void Transform(BridgePart p,RouteSegment s)
        {float x=p.X,z=p.Z;p.X=s.StartX+x*s.DirX-z*s.DirZ;p.Z=s.StartZ+x*s.DirZ+z*s.DirX;p.Yaw=(p.Yaw+s.Yaw)%360;}
        static void Transform(BridgeSolid b,RouteSegment s)
        {
            float ax=s.StartX+b.MinX*s.DirX-b.MinZ*s.DirZ,az=s.StartZ+b.MinX*s.DirZ+b.MinZ*s.DirX;
            float bx=s.StartX+b.MaxX*s.DirX-b.MaxZ*s.DirZ,bz=s.StartZ+b.MaxX*s.DirZ+b.MaxZ*s.DirX;
            b.MinX=Math.Min(ax,bx);b.MaxX=Math.Max(ax,bx);b.MinZ=Math.Min(az,bz);b.MaxZ=Math.Max(az,bz);
        }
        static void BuildSegment(RouteResult result,RouteSegment seg)
        {
            if(seg.HasOpening)
            {
                foreach(var source in seg.OpeningPlan.Parts)
                {
                    if(source.SourceId=="sb03.coping"||source.SourceId=="sb03.rail"||source.SourceId=="sb03.post")continue;
                    var p=new BridgePart{Id=source.Id,SourceId=source.SourceId,Role=source.Role,X=source.X,Y=source.Y,Z=source.Z,Yaw=source.Yaw};Transform(p,seg);result.Plan.Parts.Add(p);
                }
                foreach(var source in seg.OpeningPlan.Solids){var b=new BridgeSolid{Id=source.Id,Role=source.Role,MinX=source.MinX,MaxX=source.MaxX,MinY=source.MinY,MaxY=source.MaxY,MinZ=source.MinZ,MaxZ=source.MaxZ};Transform(b,seg);result.Plan.Solids.Add(b);}return;
            }
            int rows=(int)Math.Round(seg.Length/.5f),lanes=(int)Math.Round(result.Document.Width/.5f),rises=(int)Math.Round(Math.Abs(seg.EndHeight-seg.StartHeight)/.25f);
            bool ascending=seg.EndHeight>seg.StartHeight;
            BridgeSolid previous=null;
            for(int row=0;row<rows;row++)
            {
                float top=rises==0?seg.StartHeight:ascending?seg.StartHeight+(float)Math.Ceiling((row+1)*rises/(double)rows)*.25f:seg.EndHeight+(float)Math.Ceiling((rows-row)*rises/(double)rows)*.25f;
                for(int lane=0;lane<lanes;lane++)
                {
                    var p=Part(result.Document.Id+"/"+seg.Id+"/walk/"+row+"/"+lane,rises==0?"deck":"tread",rises==0?"deck.surface":"stair.tread",row*.5f+.25f,top-.25f,-result.Document.Width*.5f+(lane+.5f)*.5f,!ascending&&rises>0?180:0);
                    Transform(p,seg);result.Plan.Parts.Add(p);
                }
                if(top>.25f+E)
                {
                    if(previous!=null&&Math.Abs(previous.MaxY-(top-.25f))<E)previous.MaxX=(row+1)*.5f;
                    else{previous=new BridgeSolid{Id=result.Document.Id+"/"+seg.Id+"/core/"+row,Role="support.generated-core",MinX=row*.5f,MaxX=(row+1)*.5f,MinY=0,MaxY=top-.25f,MinZ=-result.Document.Width*.5f,MaxZ=result.Document.Width*.5f};result.Plan.Solids.Add(previous);}
                }
            }
            // Transform after merging in the segment-local frame.
            foreach(var b in result.Plan.Solids.Where(b=>b.Id.StartsWith(result.Document.Id+"/"+seg.Id+"/core/",StringComparison.Ordinal)))Transform(b,seg);
        }
        static void BuildLanding(RouteResult r,RouteNode n)
        {
            int lanes=(int)Math.Round(r.Document.Width/.5f);float h=r.Document.Width/2;
            for(int x=0;x<lanes;x++)for(int z=0;z<lanes;z++)r.Plan.Parts.Add(Part(r.Document.Id+"/node/"+n.Id+"/deck/"+x+"/"+z,"deck","junction.deck",n.X-h+(x+.5f)*.5f,n.Y-.25f,n.Z-h+(z+.5f)*.5f));
            if(n.Y>.25f)r.Plan.Solids.Add(new BridgeSolid{Id=r.Document.Id+"/node/"+n.Id+"/core",Role="junction.generated-core",MinX=n.X-h,MaxX=n.X+h,MinY=0,MaxY=n.Y-.25f,MinZ=n.Z-h,MaxZ=n.Z+h});
        }
        sealed class Cell{public int X,Z;public float Top;public string Owner;public bool Junction;}
        sealed class Vertex{public int X,Z;public float Low=float.MaxValue,High=float.MinValue,NX,NZ;public int Edges;public bool Junction;public string Owner;}
        static string Key(int x,int z){return x+"_"+z;}
        static bool TerminalPort(RouteResult r,float x,float z,int nx,int nz)
        {
            var first=r.Segments[0];var last=r.Segments[r.Segments.Count-1];float half=r.Document.Width/2;
            if(nx==-first.DirX&&nz==-first.DirZ)
            {
                float dx=x-first.StartX,dz=z-first.StartZ;
                if(Math.Abs(dx*first.DirX+dz*first.DirZ)<E&&Math.Abs(-dx*first.DirZ+dz*first.DirX)<=half+E)return true;
            }
            if(nx==last.DirX&&nz==last.DirZ)
            {
                float dx=x-last.EndX,dz=z-last.EndZ;
                if(Math.Abs(dx*last.DirX+dz*last.DirZ)<E&&Math.Abs(-dx*last.DirZ+dz*last.DirX)<=half+E)return true;
            }
            return false;
        }
        static void BuildBoundary(RouteResult r)
        {
            var cells=new Dictionary<string,Cell>();var vertices=new Dictionary<string,Vertex>();
            foreach(var p in r.Plan.Parts.Where(p=>p.SourceId=="sb03.tread"||p.SourceId=="sb03.deck"))
            {int x=(int)Math.Round((p.X-.25f)/.5f),z=(int)Math.Round((p.Z-.25f)/.5f);cells[Key(x,z)]=new Cell{X=x,Z=z,Top=p.Y+.25f,Owner=p.Id,Junction=p.Role=="junction.deck"};}
            Action<int,int,int,int,Cell> vertex=(x,z,nx,nz,c)=>{string key=Key(x,z);Vertex v;if(!vertices.TryGetValue(key,out v)){v=new Vertex{X=x,Z=z,Owner=c.Owner};vertices.Add(key,v);}v.Low=Math.Min(v.Low,c.Top);v.High=Math.Max(v.High,c.Top);v.NX+=nx;v.NZ+=nz;v.Edges++;v.Junction|=c.Junction;};
            foreach(var c in cells.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z))for(int side=0;side<4;side++)
            {
                int nx=side==0?-1:side==1?1:0,nz=side==2?-1:side==3?1:0;if(cells.ContainsKey(Key(c.X+nx,c.Z+nz)))continue;
                float edgeX=(c.X+.5f)*.5f+nx*.25f,edgeZ=(c.Z+.5f)*.5f+nz*.25f,yaw=nx!=0?270:0;
                string stem=c.Owner+"/edge/"+side;string role=c.Junction?"junction.edge.coping":"edge.coping";
                r.Plan.Parts.Add(Part(stem+"/coping","coping",role,edgeX+nx*.125f,c.Top-.25f,edgeZ+nz*.125f,yaw));
                // A walking entrance/exit is an open port, not a guard edge.
                // Its low stone nosing remains, but neither rail nor interior
                // post vertices may be derived across the passage.
                if(TerminalPort(r,edgeX,edgeZ,nx,nz))continue;
                if(r.Document.Rails)r.Plan.Parts.Add(Part(stem+"/rail","rail",c.Junction?"junction.guard.rail":"guard.rail",edgeX+nx*.0625f,c.Top,edgeZ+nz*.0625f,yaw));
                int vx=c.X+(nx>0?1:0),vz=c.Z+(nz>0?1:0);
                if(nx!=0){vertex(vx,c.Z,nx,nz,c);vertex(vx,c.Z+1,nx,nz,c);}else{vertex(c.X,vz,nx,nz,c);vertex(c.X+1,vz,nx,nz,c);}
            }
            if(!r.Document.Rails)return;
            foreach(var v in vertices.Values.OrderBy(v=>v.X).ThenBy(v=>v.Z))
            {
                bool corner=Math.Abs(v.NX)>E&&Math.Abs(v.NZ)>E,step=v.High-v.Low>E;
                if(v.Edges>1&&!corner&&!step&&(v.X+v.Z)%2!=0)continue;
                // Open-port end posts have a single remaining side edge. Keep
                // their complete quarter-metre envelope outside the walk width.
                float offset=v.Edges==1?.125f:.0625f;
                r.Plan.Parts.Add(Part(v.Owner+"/post/"+Key(v.X,v.Z),"post",v.Junction?"junction.guard.post":"guard.post",v.X*.5f+v.NX*offset,v.Low,v.Z*.5f+v.NZ*offset));
            }
        }
    }
}
