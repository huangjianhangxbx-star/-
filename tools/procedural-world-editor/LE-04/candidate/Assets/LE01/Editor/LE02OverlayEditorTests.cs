using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // The mask is tested on actual GPU pixels. Collider rays and literal author heights
    // provide the independent oracle, rather than querying the overlay implementation.
    public static class LE02OverlayEditorTests
    {
        [Serializable] sealed class Check { public string name,status,detail; }
        [Serializable] sealed class Frame
        {
            public string name,baseline,overlay; public int changedPixels,visibleNativeTopPixels,invalidChangedPixels,derivedLedgePixels,changedLedgePixels,foregroundPixels,changedForegroundPixels,onePixelBoundaryChanges;
        }
        [Serializable] sealed class Report
        {
            public string engine,utc,sourceHash,status="PASS",scope="Actual production shader in the camera URP color/depth pass; independent camera/Physics rays and literal author heights. One-pixel silhouette band is counted separately because GPU raster and collider rays disagree exactly at edges; all interior mismatches must be zero. Not physical GUI input.";
            public List<Check> checks=new List<Check>();public List<Frame> frames=new List<Frame>();
        }
        sealed class Fixture
        {
            public LE01TerrainAuthor author;public Camera camera;public GameObject cameraObject;public GameObject foreground;
            public readonly Dictionary<Vector2Int,int> native=new Dictionary<Vector2Int,int>();
            public readonly List<UnityEngine.Object> owned=new List<UnityEngine.Object>();
        }
        sealed class Pixels { public Color32[] baseline,overlay;public int width,height;public Frame frame; }
        static Report report;static MethodInfo draw;
        static string Root {get{return Path.GetFullPath(Path.Combine(Application.dataPath,"../../../LE-02/reports"));}}
        static void Need(bool condition,string detail){if(!condition)throw new InvalidOperationException(detail);}
        static MethodInfo DrawMethod()
        {
            return typeof(LE02BrushOverlay).GetMethod("DrawHeightRange",BindingFlags.Public|BindingFlags.Static,null,new[]{typeof(LE01TerrainAuthor),typeof(Vector3),typeof(float),typeof(float),typeof(int),typeof(bool),typeof(bool),typeof(bool),typeof(bool)},null);
        }
        static Fixture MakeFixture(bool foreground=false)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);RenderSettings.skybox=null;RenderSettings.fog=false;RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.4f,.4f,.4f);
            var key=new GameObject("OverlayPixelLight").AddComponent<Light>();key.type=LightType.Directional;key.intensity=.9f;key.shadows=LightShadows.None;key.transform.rotation=Quaternion.Euler(40,-35,0);
            var doc=TerrainGenerators.UpgradeToV3(new TerrainDocument{Id="LE02_OverlayPixels",BaseHeight=-48,ActiveQuantum=4,Seed=719});
            for(int z=-32;z<32;z+=4)for(int x=-64;x<32;x+=4)doc.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=x>=0&&z>=-16&&z<16?16:0,PlaneId=x>=0&&z>=-16&&z<16?"high":"low"});
            for(int z=-16;z<16;z+=4)for(int x=48;x<80;x+=4)doc.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=0,PlaneId="disconnected"});
            var fixture=new Fixture();fixture.author=new GameObject("LE02_OverlayPixelAuthor").AddComponent<LE01TerrainAuthor>();fixture.author.Write(doc);LE01Adapter.Upload(fixture.author,TerrainCompiler.Build(doc),true,true);
            foreach(var cell in doc.Cells)for(int z=cell.Z;z<cell.Z+cell.Size;z++)for(int x=cell.X;x<cell.X+cell.Size;x++)fixture.native[new Vector2Int(x,z)]=cell.Top;
            fixture.cameraObject=new GameObject("LE02_OverlayPixelCamera");fixture.camera=fixture.cameraObject.AddComponent<Camera>();fixture.camera.orthographic=true;fixture.camera.orthographicSize=4.5f;fixture.camera.allowHDR=false;fixture.camera.allowMSAA=false;fixture.camera.clearFlags=CameraClearFlags.SolidColor;fixture.camera.backgroundColor=new Color(.12f,.14f,.16f);fixture.camera.nearClipPlane=.1f;fixture.camera.farClipPlane=100;
            fixture.camera.transform.rotation=Quaternion.Euler(65,-20,0);fixture.camera.transform.position=new Vector3(.5f,-.75f,0)-fixture.camera.transform.forward*30;
            if(foreground){fixture.foreground=GameObject.CreatePrimitive(PrimitiveType.Cube);fixture.foreground.name="VisibleForegroundOccluder";fixture.foreground.transform.position=new Vector3(-2,.55f,0);fixture.foreground.transform.localScale=new Vector3(.85f,1.1f,.85f);var material=new Material(LE01Export.Material(true));fixture.owned.Add(material);material.SetColor("_BaseColor",new Color(.75f,.45f,.3f));fixture.foreground.GetComponent<Renderer>().sharedMaterial=material;}
            Physics.SyncTransforms();return fixture;
        }
        static void DisposeFixture(Fixture fixture)
        {
            LE02BrushOverlay.Release();if(fixture.cameraObject!=null)UnityEngine.Object.DestroyImmediate(fixture.cameraObject);foreach(var owned in fixture.owned)if(owned!=null)UnityEngine.Object.DestroyImmediate(owned);
        }
        static Color32[] Read(RenderTexture target,string path)
        {
            var texture=new Texture2D(target.width,target.height,TextureFormat.RGBA32,false);try{RenderTexture.active=target;texture.ReadPixels(new Rect(0,0,target.width,target.height),0,0);texture.Apply();File.WriteAllBytes(path,texture.EncodeToPNG());return texture.GetPixels32();}finally{UnityEngine.Object.DestroyImmediate(texture);}
        }
        static bool Changed(Color32 a,Color32 b){return Math.Abs(a.r-b.r)>=6||Math.Abs(a.g-b.g)>=6||Math.Abs(a.b-b.b)>=6;}
        static bool NativeTop(Fixture fixture,RaycastHit hit,out int height)
        {
            height=0;if(!hit.transform.IsChildOf(fixture.author.transform)||hit.normal.y<.9f)return false;var local=fixture.author.transform.InverseTransformPoint(hit.point);int x=Mathf.FloorToInt(local.x/TerrainUnits.Unit),z=Mathf.FloorToInt(local.z/TerrainUnits.Unit);
            // Include the touching cell at an exact lattice boundary so the oracle does
            // not fail on a floating-point hit shared by two different-height leaves.
            for(int dx=-1;dx<=0;dx++)for(int dz=-1;dz<=0;dz++){
                if(dx<0&&Mathf.Abs(local.x/TerrainUnits.Unit-x)>.001f||dz<0&&Mathf.Abs(local.z/TerrainUnits.Unit-z)>.001f)continue;
                int top;if(fixture.native.TryGetValue(new Vector2Int(x+dx,z+dz),out top)&&Mathf.Abs(local.y-top*TerrainUnits.Unit)<.001f){height=top;return true;}
            }return false;
        }
        static Pixels Render(Fixture fixture,string name,Vector3 center,float radius,float falloff,int start,bool entire,bool soft)
        {
            var camera=fixture.camera;var target=new RenderTexture(800,640,24,RenderTextureFormat.ARGB32){antiAliasing=1};var previous=RenderTexture.active;var oldTarget=camera.targetTexture;
            var result=new Pixels{width=target.width,height=target.height,frame=new Frame{name=name,baseline=name+"-base.png",overlay=name+"-overlay.png"}};
            try{
                camera.targetTexture=target;camera.aspect=(float)target.width/target.height;camera.Render();result.baseline=Read(target,Path.Combine(Root,result.frame.baseline));
                LE02OffscreenRender.Render(camera,()=>draw.Invoke(null,new object[]{fixture.author,center,radius,falloff,start,entire,soft,false,false}));
                result.overlay=Read(target,Path.Combine(Root,result.frame.overlay));
            }finally{camera.targetTexture=oldTarget;RenderTexture.active=previous;UnityEngine.Object.DestroyImmediate(target);}
            Physics.SyncTransforms();
            var eligible=new bool[result.width*result.height];var nativeTop=new bool[eligible.Length];var derived=new bool[eligible.Length];var foreground=new bool[eligible.Length];
            for(int py=0;py<result.height;py++)for(int px=0;px<result.width;px++){
                int index=py*result.width+px;bool changed=Changed(result.baseline[index],result.overlay[index]);if(changed)result.frame.changedPixels++;
                RaycastHit hit;bool found=Physics.Raycast(camera.ViewportPointToRay(new Vector3((px+.5f)/result.width,(py+.5f)/result.height,0)),out hit,1000,~0,QueryTriggerInteraction.Ignore);
                foreground[index]=found&&fixture.foreground!=null&&hit.transform.IsChildOf(fixture.foreground.transform);if(foreground[index])result.frame.foregroundPixels++;
                int top=0;bool native=found&&NativeTop(fixture,hit,out top);
                nativeTop[index]=native;eligible[index]=native&&(soft||top==start);
                if(native)result.frame.visibleNativeTopPixels++;
                else if(found&&hit.transform.IsChildOf(fixture.author.transform)&&hit.normal.y>.9f){result.frame.derivedLedgePixels++;derived[index]=true;}
            }
            for(int py=0;py<result.height;py++)for(int px=0;px<result.width;px++){
                int index=py*result.width+px;if(!Changed(result.baseline[index],result.overlay[index])||eligible[index])continue;
                bool edge=false;for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++)if(px+dx>=0&&px+dx<result.width&&py+dy>=0&&py+dy<result.height&&eligible[(py+dy)*result.width+px+dx])edge=true;
                if(edge){result.frame.onePixelBoundaryChanges++;continue;}
                result.frame.invalidChangedPixels++;if(foreground[index])result.frame.changedForegroundPixels++;if(derived[index])result.frame.changedLedgePixels++;
            }
            Need(result.frame.onePixelBoundaryChanges<=20,"unexpectedly large GPU/collider silhouette discrepancy");
            report.frames.Add(result.frame);return result;
        }
        static bool PointChanged(Fixture fixture,Pixels pixels,Vector3 point)
        {
            Vector3 viewport=fixture.camera.WorldToViewportPoint(point);Need(viewport.z>0&&viewport.x>0&&viewport.x<1&&viewport.y>0&&viewport.y<1,"sample point must be in the render viewport");
            RaycastHit hit;Need(Physics.Raycast(fixture.camera.ViewportPointToRay(viewport),out hit,1000)&&hit.transform.IsChildOf(fixture.author.transform)&&Vector3.Distance(hit.point,point)<.015f,"sample point must be independently visible on the author: "+point);
            int x=Mathf.FloorToInt(viewport.x*pixels.width),y=Mathf.FloorToInt(viewport.y*pixels.height);int index=Mathf.Clamp(y,0,pixels.height-1)*pixels.width+Mathf.Clamp(x,0,pixels.width-1);return Changed(pixels.baseline[index],pixels.overlay[index]);
        }
        static void HardMaskUsesVisibleNativeTop()
        {
            var fixture=MakeFixture();try{var pixels=Render(fixture,"overlay-hard",new Vector3(-2,0,0),.8f,0,0,false,false);Need(pixels.frame.changedPixels>100,"hard overlay drew no visible shader pixels");Need(pixels.frame.invalidChangedPixels==0,"hard overlay tinted a hidden, non-native, or different-height face; invalid="+pixels.frame.invalidChangedPixels);Need(PointChanged(fixture,pixels,new Vector3(-2,0,0)),"hard overlay omitted its center native top");Need(!PointChanged(fixture,pixels,new Vector3(.75f,1,0)),"hard overlay tinted the raised plateau");}finally{DisposeFixture(fixture);}
        }
        static void EntirePlateauUsesConnectedAuthor()
        {
            var fixture=MakeFixture();try{var pixels=Render(fixture,"overlay-entire",new Vector3(-2,0,0),.4f,0,0,true,false);Need(pixels.frame.changedPixels>100&&pixels.frame.invalidChangedPixels==0,"entire-plateau mask did not stay on visible native Top0");Need(PointChanged(fixture,pixels,new Vector3(-3,0,0)),"connected same-height top beyond brush radius was not highlighted");Need(!PointChanged(fixture,pixels,new Vector3(.75f,1,0)),"entire plateau included a different author height");Need(!PointChanged(fixture,pixels,new Vector3(4,0,0)),"entire plateau included disconnected same-height terrain");}finally{DisposeFixture(fixture);}
        }
        static void SoftMaskIncludesNeighborNativeHeights()
        {
            var fixture=MakeFixture();try{var pixels=Render(fixture,"overlay-soft",new Vector3(-.25f,0,0),.5f,2,0,false,true);Need(pixels.frame.changedPixels>100&&pixels.frame.invalidChangedPixels==0,"soft overlay tinted a face outside visible native tops");Need(PointChanged(fixture,pixels,new Vector3(.75f,1,0)),"soft falloff omitted a neighboring different native height");Need(pixels.frame.derivedLedgePixels>0,"fixture must expose derived ledges to test their exclusion");Need(pixels.frame.changedLedgePixels==0,"soft overlay included derived horizontal rock ledges");}finally{DisposeFixture(fixture);}
        }
        static void ForegroundDepthOcclusion()
        {
            var fixture=MakeFixture(true);try{var pixels=Render(fixture,"overlay-foreground",new Vector3(-2,0,0),1.4f,0,0,false,false);Need(pixels.frame.foregroundPixels>100,"fixture foreground Cube was not visibly rendered");Need(pixels.frame.changedPixels>100,"occlusion fixture drew no unobstructed overlay");Need(pixels.frame.changedForegroundPixels==0&&pixels.frame.invalidChangedPixels==0,"mask leaked through foreground depth; foreground="+pixels.frame.changedForegroundPixels+" invalid="+pixels.frame.invalidChangedPixels);}finally{DisposeFixture(fixture);}
        }
        public static void Run()
        {
            Directory.CreateDirectory(Root);report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash()};draw=DrawMethod();
            foreach(var action in new Action[]{HardMaskUsesVisibleNativeTop,EntirePlateauUsesConnectedAuthor,SoftMaskIncludesNeighborNativeHeights,ForegroundDepthOcclusion}){
                var check=new Check{name=action.Method.Name,status="PASS"};try{Need(draw!=null,"height-range overlay API is missing");action();}catch(Exception error){check.status="FAIL";check.detail=error.GetBaseException().Message;report.status="FAIL";}report.checks.Add(check);Debug.Log("LE02_OVERLAY_PIXELS_"+check.status+" "+check.name+" "+check.detail);
            }
            File.WriteAllText(Path.Combine(Root,"overlay-pixels.json"),JsonUtility.ToJson(report,true));if(report.status!="PASS")throw new InvalidOperationException("LE02 GPU overlay mask checks failed");Debug.Log("LE02_OVERLAY_PIXELS_COMPLETE");
        }
    }
}
