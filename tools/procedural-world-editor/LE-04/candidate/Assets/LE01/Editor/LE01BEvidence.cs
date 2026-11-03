using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static partial class LE01BEvidence
    {
        public static string Root {get{return LE01Export.IterationRoot;}}
        [Serializable] public class Frame {public string image,generator,stage,view,author;public int seed,authorLeaves,derived,chunks,triangles;public float[] fixedBounds;public long buildMs;}
        [Serializable] public class Manifest {public string engine,runUtc,sourceHash,note="Actual Unity offscreen renders; all stages share the same author-derived camera bounds. Not a GUI screenshot or physical-input test.";public List<Frame> images=new List<Frame>();}
        static Manifest manifest;
        static LE01TerrainAuthor New(TerrainDocument document)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);var a=new GameObject("LE01B_Terrain").AddComponent<LE01TerrainAuthor>();a.Write(document);a.transform.position=new Vector3(document.OriginX,document.OriginY,document.OriginZ);return a;
        }
        static TerrainDocument Tall(int seed)
        {
            var a=New(new TerrainDocument{Id="B_Tall_"+seed+"_legacy",Seed=seed,BaseHeight=-128,ActiveQuantum=2});
            var s=new LE01Stroke{Author=a,Mode=BrushMode.Extend,Radius=3,Quantum=2};s.Begin(new Vector3(-3,0,0),0);s.Drag(new Vector3(3,0,0),0);if(!s.End())throw new Exception("Control author brush rejected: "+s.Status);return a.Read();
        }
        static Bounds AuthorBounds(TerrainDocument d)
        {
            float x0=d.Cells.Min(c=>c.X)*TerrainUnits.Unit,x1=d.Cells.Max(c=>c.X+c.Size)*TerrainUnits.Unit,z0=d.Cells.Min(c=>c.Z)*TerrainUnits.Unit,z1=d.Cells.Max(c=>c.Z+c.Size)*TerrainUnits.Unit,y0=d.BaseHeight*TerrainUnits.Unit,y1=d.Cells.Max(c=>c.Top)*TerrainUnits.Unit;
            return new Bounds(new Vector3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),new Vector3(x1-x0,y1-y0,z1-z0));
        }
        static void Light()
        {
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.35f,.35f,.35f);RenderSettings.skybox=null;RenderSettings.fog=false;
            var l=new GameObject("EvidenceKey").AddComponent<Light>();l.type=LightType.Directional;l.color=Color.white;l.intensity=.9f;l.transform.rotation=Quaternion.Euler(35,-48,0);l.shadows=LightShadows.Soft;l.shadowBias=.025f;l.shadowNormalBias=.04f;
        }
        static void Capture(LE01TerrainAuthor a,TerrainBuild build,Bounds bounds,int seed,string stage,string view,string author,string prefix="Tall")
        {
            var camera=new GameObject("EvidenceCamera").AddComponent<Camera>();camera.orthographic=true;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.16f,.18f,.20f);
            camera.transform.rotation=Quaternion.Euler(view=="side"?0:18,view=="side"?0:-28,0);camera.orthographicSize=Mathf.Max(bounds.size.y*.72f,bounds.size.x*.52f);camera.transform.position=a.transform.TransformPoint(bounds.center)-camera.transform.forward*40;camera.nearClipPlane=.1f;camera.farClipPlane=100;
            var rt=new RenderTexture(1280,960,24,RenderTextureFormat.ARGB32);camera.targetTexture=rt;camera.Render();var old=RenderTexture.active;RenderTexture.active=rt;var texture=new Texture2D(1280,960,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,1280,960),0,0);texture.Apply();
            string name=prefix+"_"+seed+"-"+stage+"-"+view+".png",relative="samples/screenshots/"+name;File.WriteAllBytes(Path.Combine(Root,relative),texture.EncodeToPNG());
            manifest.images.Add(new Frame{image=relative,generator=a.Read().GeneratorVersion,stage=stage,view=view,author=author,seed=seed,authorLeaves=build.AuthorLeaves,derived=build.DerivedCells,chunks=build.Chunks.Count,triangles=build.Chunks.Sum(c=>c.Triangles.Length/3),fixedBounds=new[]{bounds.center.x,bounds.center.y,bounds.center.z,bounds.size.x,bounds.size.y,bounds.size.z},buildMs=build.Milliseconds});
            RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(texture);UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(camera.gameObject);
        }
        public static void EarlyForm(){RenderForm(false);}
        public static void FormGate(){RenderForm(true);}
        public static void FinalStages()
        {
            manifest=new Manifest{engine=Application.unityVersion,runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            var document=LE01Adapter.NativeLoad(Path.Combine(Root,"samples/Tall_719_v2.leterrain.json"));var a=New(document);Light();LE01Adapter.SetGray(a,true);var bounds=AuthorBounds(document);
            foreach(int level in new[]{0,1}){var build=TerrainCompiler.Build(document,null,level);LE01Adapter.Upload(a,build,true,true);Capture(a,build,bounds,719,level==0?"primary":"events","oblique","samples/Tall_719_v2.leterrain.json");}
            File.WriteAllText(Path.Combine(Root,"notes/final-stage-manifest.json"),JsonUtility.ToJson(manifest,true));Debug.Log("LE01B_FINAL_STAGES_COMPLETE");
        }
        static void RenderForm(bool gateOnly)
        {
            Directory.CreateDirectory(Path.Combine(Root,"samples/screenshots"));Directory.CreateDirectory(Path.Combine(Root,"notes"));manifest=new Manifest{engine=Application.unityVersion,runUtc=DateTime.UtcNow.ToString("O"),sourceHash=SourceHash()};
            try{
                foreach(int seed in new[]{719,1847}){
                    string legacyFile="samples/Tall_"+seed+"_legacy.leterrain.json";var legacy=gateOnly&&File.Exists(Path.Combine(Root,legacyFile))?LE01Adapter.NativeLoad(Path.Combine(Root,legacyFile)):Tall(seed);var bounds=AuthorBounds(legacy);var a=New(legacy);if(!gateOnly)LE01Adapter.NativeSave(a,Path.Combine(Root,legacyFile));Light();LE01Adapter.SetGray(a,true);
                    if(!gateOnly){var old=TerrainCompiler.Build(legacy);LE01Adapter.Upload(a,old,true,true);Capture(a,old,bounds,seed,"legacy","oblique",legacyFile);Capture(a,old,bounds,seed,"legacy","side",legacyFile);}
                    var current=TerrainGenerators.UpgradeToV2(legacy);a.Write(current);string native="samples/Tall_"+seed+"_v2.leterrain.json";LE01Adapter.NativeSave(a,Path.Combine(Root,native));
                    TerrainBuild complete=null;
                    foreach(int feature in !gateOnly&&seed==719?new[]{0,1,2}:new[]{2}){
                        var build=TerrainCompiler.Build(current,null,feature);LE01Adapter.Upload(a,build,true,true);string stage=new[]{"primary","events","full"}[feature];Capture(a,build,bounds,seed,stage,"oblique",native);if(feature==2){Capture(a,build,bounds,seed,stage,"side",native);complete=build;}
                    }
                    if(complete!=null){CaptureGroups(a,complete,bounds,seed,native);LE01Adapter.SetGray(a,false);LE01Adapter.SaveSceneMeshes(a,"Assets/LE01B/Scenes/Tall_"+seed+".unity");}
                }
            }finally{File.WriteAllText(Path.Combine(Root,gateOnly?"notes/form-gate-manifest.json":"notes/form-stage-manifest.json"),JsonUtility.ToJson(manifest,true));AssetDatabase.SaveAssets();}
            Debug.Log("LE01B_EARLY_FORM_COMPLETE");
        }
        static void CaptureGroups(LE01TerrainAuthor a,TerrainBuild build,Bounds bounds,int seed,string author)
        {
            var ids=build.Chunks.SelectMany(c=>c.TriangleGroupIds).Where(s=>!string.IsNullOrEmpty(s)).Distinct().OrderBy(s=>s).ToArray();if(ids.Length==0){Debug.Log("LE01B_GROUP_CAPTURE_NOT_RUN no triangle mapping");return;}
            var tex=new Texture2D(ids.Length+1,1,TextureFormat.RGBA32,false);tex.filterMode=FilterMode.Point;var colors=new List<Color>{new Color(.6f,.6f,.6f)};foreach(string id in ids){unchecked{uint h=2166136261;foreach(char ch in id){h^=ch;h*=16777619;}colors.Add(Color.HSVToRGB((h%997)/997f,.62f,.82f));}}tex.SetPixels(colors.ToArray());tex.Apply();
            var material=new Material(Shader.Find("Universal Render Pipeline/Unlit"));material.SetTexture("_BaseMap",tex);material.SetColor("_BaseColor",Color.white);
            var records=new List<Tuple<MeshFilter,Mesh,Mesh,Material>>();
            try{
                foreach(var data in build.Chunks){var child=LE01Adapter.Geometry(a).transform.Find(data.Id);if(child==null||data.Triangles.Length==0)continue;var f=child.GetComponent<MeshFilter>();var original=f.sharedMesh;var copy=UnityEngine.Object.Instantiate(original);var uv=new Vector2[copy.vertexCount];
                    for(int t=0;t<data.TriangleGroupIds.Length;t++){int slot=string.IsNullOrEmpty(data.TriangleGroupIds[t])?0:Array.IndexOf(ids,data.TriangleGroupIds[t])+1;for(int k=0;k<3;k++)uv[data.Triangles[t*3+k]]=new Vector2((slot+.5f)/(ids.Length+1),.5f);}copy.uv=uv;var r=child.GetComponent<MeshRenderer>();records.Add(Tuple.Create(f,original,copy,r.sharedMaterial));f.sharedMesh=copy;r.sharedMaterial=material;
                }
                Capture(a,build,bounds,seed,"groups","oblique",author);File.WriteAllText(Path.Combine(Root,"notes/Tall_"+seed+"-groups.json"),"{\"groupIds\":["+string.Join(",",ids.Select(s=>"\""+s+"\""))+"],\"note\":\"Transient triangle parent colors, original palette unchanged\"}");
            }finally{foreach(var item in records){item.Item1.sharedMesh=item.Item2;item.Item1.GetComponent<MeshRenderer>().sharedMaterial=item.Item4;UnityEngine.Object.DestroyImmediate(item.Item3);}UnityEngine.Object.DestroyImmediate(material);UnityEngine.Object.DestroyImmediate(tex);}
        }
    }
}
