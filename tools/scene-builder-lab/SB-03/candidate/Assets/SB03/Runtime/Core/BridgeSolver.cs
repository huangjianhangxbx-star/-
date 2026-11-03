using System;

namespace XingHai.SB03
{
    /// <summary>
    /// Dedicated, original single-span stone-bridge recipe. Inputs live in a
    /// bridge-local frame. It does not voxelize source models or modify terrain.
    /// The generated volumes are only the recipe's declared load-bearing core;
    /// every named surface/ornament is an unchanged source-mesh placement.
    /// </summary>
    public static class BridgeSolver
    {
        const float Epsilon=.0001f;
        static bool Finite(float n){return !float.IsNaN(n)&&!float.IsInfinity(n);}
        static bool OnGrid(float n,float step){return Math.Abs(n/step-(float)Math.Round(n/step))<Epsilon;}
        static BridgePlan Reject(string message){return new BridgePlan{Message=message};}
        public static BridgePlan Solve(BridgeSpec spec)
        {
            if(spec==null)return Reject("缺少桥梁参数。");
            if(string.IsNullOrWhiteSpace(spec.Id)||spec.Id.Length>80)return Reject("桥梁身份必须为1—80字符。");
            foreach(float v in new[]{spec.Length,spec.Width,spec.DeckHeight,spec.StartHeight,spec.EndHeight,spec.ArchWidth,spec.ArchHeight})
                if(!Finite(v))return Reject("尺寸必须为有限数字。");
            if(spec.Length<3||spec.Length>40||!OnGrid(spec.Length,.5f))return Reject("桥长须为3—40m，按0.5m构件递增。");
            if(spec.Width<1||spec.Width>6||!OnGrid(spec.Width,.5f))return Reject("净宽须为1—6m，按0.5m铺面递增；构件不拉伸。");
            if(spec.DeckHeight<.25f||spec.DeckHeight>5||!OnGrid(spec.DeckHeight,.25f))return Reject("桥面标高须为0.25—5m，按0.25m步高递增。");
            if(spec.StartHeight<0||spec.EndHeight<0||spec.StartHeight>spec.DeckHeight||spec.EndHeight>spec.DeckHeight||!OnGrid(spec.StartHeight,.25f)||!OnGrid(spec.EndHeight,.25f))
                return Reject("两端标高须在地面与桥面之间，并按0.25m递增。");
            var p=new BridgePlan{Spec=spec.Clone()};
            p.StartSteps=(int)Math.Round((spec.DeckHeight-spec.StartHeight)/.25f);
            p.EndSteps=(int)Math.Round((spec.DeckHeight-spec.EndHeight)/.25f);
            p.DeckStart=p.StartSteps*.5f;p.DeckEnd=spec.Length-p.EndSteps*.5f;
            if(p.DeckEnd-p.DeckStart<1-Epsilon)return Reject("桥长不足以容纳两端台阶与至少1m落脚平台；请加长或降低桥面。");
            if(spec.Opening)
            {
                if(spec.ArchWidth<1||spec.ArchWidth>12||!OnGrid(spec.ArchWidth,.5f))return Reject("拱洞宽须为1—12m，按0.5m递增。");
                if(spec.ArchHeight<.5f||!OnGrid(spec.ArchHeight,.25f)||spec.ArchHeight>spec.DeckHeight-.75f+Epsilon)
                    return Reject("拱洞净高须不少于0.5m，且为桥面保留至少0.75m的铺面与拱顶厚度。");
                if(spec.ArchWidth>p.DeckEnd-p.DeckStart-1+Epsilon)return Reject("水平桥段不足以容纳拱洞和两侧各0.5m桥台；请加长或缩小洞宽。");
                // Centred to a .25m structural boundary even when the plateau
                // has an odd number of half-metre cells.
                p.OpeningMinX=(float)Math.Floor(((p.DeckStart+p.DeckEnd-spec.ArchWidth)*.5f)/.25f)*.25f;
                p.OpeningMaxX=p.OpeningMinX+spec.ArchWidth;p.OpeningCrown=spec.ArchHeight;
            }
            p.Valid=true;p.Message="可生成：直线阶梯石桥。";
            WalkingSources(p);
            LoadBearingCore(p);
            ArchSources(p);
            if(p.Parts.Count>5000||p.Solids.Count>512)return Reject("本桥超出构件或支承预算；上次结果保留。");
            return p;
        }
        static void Part(BridgePlan p,string id,string source,string role,float x,float y,float z,float yaw=0)
        {p.Parts.Add(new BridgePart{Id=p.Spec.Id+"/"+id,SourceId="sb03."+source,Role=role,X=x,Y=y,Z=z,Yaw=yaw});}
        static void WalkingSources(BridgePlan p)
        {
            var s=p.Spec;int rows=(int)Math.Round(s.Length/.5f),lanes=(int)Math.Round(s.Width/.5f);
            for(int row=0;row<rows;row++)
            {
                float x=(row+.5f)*.5f,top=p.WalkingHeightAt(x);
                bool stair=x<p.DeckStart||x>=p.DeckEnd;float yaw=x>=p.DeckEnd?180:0;
                for(int lane=0;lane<lanes;lane++)
                    Part(p,"walk/"+row+"/"+lane,stair?"tread":"deck",stair?"stair.tread":"deck.surface",x,top-.25f,-s.Width*.5f+(lane+.5f)*.5f,yaw);
                for(int side=-1;side<=1;side+=2)
                {
                    float z=side*(s.Width*.5f+.125f);
                    Part(p,"coping/"+side+"/"+row,"coping","edge.coping",x,top-.25f,z);
                    if(s.Rails)Part(p,"rail/"+side+"/"+row,"rail","guard.rail",x,top,side*(s.Width*.5f+.0625f));
                }
            }
            if(s.Rails)
            {
                // At every change of level a tall post joins adjacent stepped
                // rails; the level span uses a calmer one-metre rhythm.
                for(int station=0;station<=rows;station++)
                {
                    float x=station*.5f;
                    bool onStair=x<=p.DeckStart||x>=p.DeckEnd;
                    if(!onStair&&station%2!=0)continue;
                    float before=p.WalkingHeightAt(Math.Max(.001f,x-.001f));
                    float after=p.WalkingHeightAt(Math.Min(s.Length-.001f,x+.001f));
                    float y=Math.Min(before,after);
                    for(int side=-1;side<=1;side+=2)Part(p,"post/"+side+"/"+station,"post","guard.post",x,y,side*(s.Width*.5f+.125f));
                }
            }
            for(int side=-1;side<=1;side+=2)
            {
                // Authored cap islands sit on the external shoulder, below the
                // coping; they expose the landing/support transition in profile.
                Part(p,"abutment/start/"+side,"abutment-cap","support.abutment-cap",p.DeckStart+.25f,Math.Max(0,s.DeckHeight-.5f),side*(s.Width*.5f+.25f));
                Part(p,"abutment/end/"+side,"abutment-cap","support.abutment-cap",p.DeckEnd-.25f,Math.Max(0,s.DeckHeight-.5f),side*(s.Width*.5f+.25f));
            }
        }
        static void LoadBearingCore(BridgePlan p)
        {
            var s=p.Spec;int columns=(int)Math.Round(s.Length/.25f);
            for(int i=0;i<columns;i++)
            {
                float minX=i*.25f,maxX=minX+.25f,x=(minX+maxX)*.5f;
                float bottom=p.OpeningHeightAt(x),top=p.WalkingHeightAt(x)-.25f;
                if(top<=bottom+Epsilon)continue;
                // Adjacent identical vertical columns form one coarse prism.
                // The adapter emits the union surface, not faces between prisms.
                BridgeSolid last=p.Solids.Count==0?null:p.Solids[p.Solids.Count-1];
                if(last!=null&&Math.Abs(last.MaxX-minX)<Epsilon&&last.MinY==bottom&&last.MaxY==top)last.MaxX=maxX;
                else p.Solids.Add(new BridgeSolid{Id=s.Id+"/core/"+i,Role="support.generated-core",MinX=minX,MaxX=maxX,MinY=bottom,MaxY=top,MinZ=-s.Width*.5f,MaxZ=s.Width*.5f});
            }
        }
        static void ArchSources(BridgePlan p)
        {
            var s=p.Spec;if(!s.Opening)return;
            int count=(int)Math.Round(s.ArchWidth/.25f);float centre=(p.OpeningMinX+p.OpeningMaxX)*.5f;
            for(int side=-1;side<=1;side+=2)
            {
                float z=side*(s.Width*.5f+.125f);
                for(int i=0;i<count;i++)
                {
                    float x=p.OpeningMinX+(i+.5f)*.25f;
                    // The half-metre key replaces the two centre ring stones.
                    if(x>centre-.25f&&x<centre+.25f)continue;
                    float lower=p.OpeningHeightAt(x);
                    float upper=Math.Max(lower,Math.Max(p.OpeningHeightAt(x-.25f),p.OpeningHeightAt(x+.25f)));
                    // Fill the vertical riser of a stepped arch ring, too. A
                    // single loose stone at every height would leave visible
                    // gaps on a high/narrow allowed profile.
                    int courses=(int)Math.Round((upper-lower)/.25f);
                    for(int course=0;course<=courses;course++)
                        Part(p,"arch/ring/"+side+"/"+i+"/"+course,"arch-stone","arch.course",x,lower+course*.25f,z);
                }
                Part(p,"arch/foot-left/"+side,"arch-foot","arch.springing",p.OpeningMinX-.25f,0,z);
                Part(p,"arch/foot-right/"+side,"arch-foot","arch.springing",p.OpeningMaxX+.25f,0,z,180);
                float leftHeight=p.OpeningHeightAt(p.OpeningMinX+.125f);
                float rightHeight=p.OpeningHeightAt(p.OpeningMaxX-.125f);
                for(int y=2;y*.25f<=leftHeight+Epsilon;y++)
                    Part(p,"arch/left-riser/"+side+"/"+y,"arch-stone","arch.course",p.OpeningMinX-.125f,y*.25f,z);
                for(int y=2;y*.25f<=rightHeight+Epsilon;y++)
                    Part(p,"arch/right-riser/"+side+"/"+y,"arch-stone","arch.course",p.OpeningMaxX+.125f,y*.25f,z);
                Part(p,"arch/key/"+side,"keystone","arch.crown",centre,s.ArchHeight,z);
            }
        }
    }
}
