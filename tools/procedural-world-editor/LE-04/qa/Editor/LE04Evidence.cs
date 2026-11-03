using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01;
using XingHai.LE01.Core;
using XingHai.LE01.Editor;
namespace XingHai.LE04.QA
{
 public static class LE04Evidence
 {
  const string Scene="Assets/LE04/Scenes/LE04_Workflow.unity";
  [Serializable] sealed class Step {public string action,hash,mesh,status,image;public int revision,ownedColumns,paintRuns,triangles,chunks;public float[] bounds;}
  [Serializable] sealed class ReferenceProof {public string id,sourceHash,inputFileSha,snapshotSha;public int voxels,palette;}
  [Serializable] sealed class Report
  {
   public string status="RUNNING",engine,sourceHash,error,authorHash,meshHash,brushJsonSha,scene=Scene,completeFile="samples/LE04_Workflow.basicterrain.json",export="exports/LE04_Workflow.fbx";
   public string scope="Actual production session operations and Unity URP camera renders in isolated background Editor. Controller workflow evidence; SceneView event tests are separate. No synthetic geometry or physical-input claim. A and the original prop retain independent meshes.";
   public string independentSource="references/ridge/le04.reference.ridge.palette.fbx",independentSourceSha,independentMeshHash;public bool reopened;public float[] independentMatrix;public List<ReferenceProof> references=new List<ReferenceProof>();
   public List<Step> steps=new List<Step>();public List<string> checks=new List<string>();
  }
  static string root;static Report report;static LE01TerrainAuthor author;static LE04TerrainSession session;static Camera camera;static GameObject prop;static Matrix4x4 propMatrix;static string propHash,beforeCut,afterCut,afterCutMesh;static int phase,uploadCount;static double started;static bool reopening;
  static string Root {get{return Environment.GetEnvironmentVariable("LE04_OUTPUT_ROOT")??throw new InvalidOperationException("Set LE04_OUTPUT_ROOT.");}}
  static void Need(bool value,string text){if(!value)throw new InvalidOperationException(text);report.checks.Add(text);UnityEngine.Debug.Log("LE04_EVIDENCE_CHECK "+text);}
  static string FileHash(string file){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(file))).Replace("-","");}
  static string TextHash(string value){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value))).Replace("-","");}
  static float[] MatrixValues(Matrix4x4 value){var result=new float[16];for(int i=0;i<16;i++)result[i]=value[i];return result;}
  static string ObjectMeshHash(GameObject value)
  {
   using(var stream=new MemoryStream())using(var writer=new BinaryWriter(stream)){foreach(var f in value.GetComponentsInChildren<MeshFilter>().OrderBy(f=>f.name)){writer.Write(f.name);var mesh=f.sharedMesh;writer.Write(mesh.vertexCount);foreach(var p in mesh.vertices){writer.Write(p.x);writer.Write(p.y);writer.Write(p.z);}writer.Write(mesh.normals.Length);foreach(var n in mesh.normals){writer.Write(n.x);writer.Write(n.y);writer.Write(n.z);}writer.Write(mesh.uv.Length);foreach(var uv in mesh.uv){writer.Write(uv.x);writer.Write(uv.y);}writer.Write(mesh.subMeshCount);foreach(var t in mesh.triangles)writer.Write(t);}writer.Flush();using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream.ToArray())).Replace("-","");}
  }
  static void Begin()
  {
   if(!Application.isBatchMode)throw new InvalidOperationException("Evidence runs only in the isolated QA project.");root=Root;Directory.CreateDirectory(Path.Combine(root,"samples/screenshots"));Directory.CreateDirectory(Path.Combine(root,"exports"));Directory.CreateDirectory(Path.Combine(root,"reports"));report=new Report{engine=Application.unityVersion,sourceHash=LE01BEvidence.SourceHash()};started=EditorApplication.timeSinceStartup;
  }
  public static void Run()
  {
   Begin();EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
   RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.42f,.45f,.49f);RenderSettings.skybox=null;RenderSettings.fog=false;
   var light=new GameObject("LE04_WorkflowKey").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.15f;light.color=new Color(1,.94f,.84f);light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(38,-42,0);
   camera=new GameObject("LE04_WorkflowCamera").AddComponent<Camera>();camera.orthographic=true;camera.orthographicSize=5.1f;camera.aspect=1280f/900;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.53f,.63f,.69f);camera.allowHDR=false;camera.allowMSAA=false;camera.nearClipPlane=.1f;camera.farClipPlane=100;camera.transform.rotation=Quaternion.Euler(27,-32,0);camera.transform.position=new Vector3(.5f,-.2f,0)-camera.transform.forward*35;
   var basis=TerrainGenerators.UpgradeToV3(new TerrainDocument{Id="LE04_Workflow",BaseHeight=-32,Seed=719,ActiveQuantum=4,BrushRadius=1.5f});var command=new TerrainCommand{Mode=BrushMode.Extend,Radius=3,Quantum=4,PlaneHeight=0};command.Path.Add(new Point2(-2.5f,0));command.Path.Add(new Point2(2.5f,0));var land=TerrainKernel.Apply(basis,command);Need(!land.Rejected&&land.Changed,"Initial continuous base landmass uses existing cliff author rules");
   author=new GameObject("LE04_BasicTerrain").AddComponent<LE01TerrainAuthor>();author.Write(land.Document);author.gameObject.AddComponent<LE04TerrainState>().Write(new TerrainEditState());session=LE04TerrainSession.Get(author);phase=0;EditorApplication.update+=Update;
  }
  static Vector3 Top(float x,float z)
  {Physics.SyncTransforms();RaycastHit hit;Need(Physics.Raycast(new Ray(new Vector3(x,12,z),Vector3.down),out hit,30)&&hit.collider.GetComponentInParent<LE01TerrainAuthor>()==author,"Actual visible top hit "+x+","+z);return author.transform.InverseTransformPoint(hit.point);}
  static Vector3 Side(float x,float y)
  {Physics.SyncTransforms();RaycastHit hit;Need(Physics.Raycast(new Ray(new Vector3(x,y,-12),Vector3.forward),out hit,30)&&hit.collider.GetComponentInParent<LE01TerrainAuthor>()==author,"Actual visible side hit "+x+","+y);return author.transform.InverseTransformPoint(hit.point);}
  static void SculptSettings()
  {var s=session.Settings;s.Tool="shape";s.Mode="SmoothRaise";s.Quantum=4;s.Amount=.75f;s.Falloff=.6f;s.YBelow=3;s.YAbove=3;s.NegativeX=.75f;s.PositiveX=2;s.NegativeZ=.75f;s.PositiveZ=1.5f;}
  static void Reference(string name,int index,float sx,float sy,float sz,float yaw,ReferenceBrushMode mode,params Vector3[] path)
  {
   var s=session.Settings;s.Tool="reference";s.ReferenceIndex=index;s.ReferenceMode=mode;s.Quantum=4;s.ScaleX=sx;s.ScaleY=sy;s.ScaleZ=sz;s.Yaw=yaw;s.BlendWidth=.125f;s.UseColor=true;s.AnchorMode=false;
   Need(session.BeginStroke(path[0],mode==ReferenceBrushMode.Subtract?Vector3.back:Vector3.up),name+" starts from frozen hit/work-plane");
   for(int k=1;k<path.Length;k++)for(int n=1;n<=30;n++)session.Drag(Vector3.Lerp(path[k-1],path[k],n/30f),mode==ReferenceBrushMode.Subtract?Vector3.back:Vector3.up);session.Release();
  }
  static void ImportSourcesAndProp()
  {
   foreach(var name in new[]{"ridge","notched-terrace"}){string path=Path.Combine(root,"references",name,"source.voxel.json");var asset=LE04TerrainFiles.ReadReference(File.ReadAllText(path));Need(session.AddReference(asset,path),"Real workshop "+name+" sampled and embedded");}
   const string folder="Assets/LE04/OriginalProps";LE01Export.Folder(folder);string fbx="le04.reference.ridge.palette.fbx",png="le04.reference.ridge.palette.png";foreach(var file in new[]{fbx,png})File.Copy(Path.Combine(root,"references/ridge",file),folder+"/"+file,true);AssetDatabase.ImportAsset(folder+"/"+png,ImportAssetOptions.ForceSynchronousImport);AssetDatabase.ImportAsset(folder+"/"+fbx,ImportAssetOptions.ForceSynchronousImport);
   var original=AssetDatabase.LoadAssetAtPath<GameObject>(folder+"/"+fbx);Need(original!=null,"Original FBX imports as an independent prop");prop=(GameObject)PrefabUtility.InstantiatePrefab(original);prop.name="IndependentOriginal_Ridge_NotABuildingTool";prop.transform.position=new Vector3(5.5f,0,1.8f);propMatrix=prop.transform.localToWorldMatrix;propHash=ObjectMeshHash(prop);report.independentSourceSha=FileHash(Path.Combine(root,report.independentSource));report.independentMeshHash=propHash;report.independentMatrix=MatrixValues(propMatrix);
   var shaders=Shader.Find("Universal Render Pipeline/Lit");string texturePath=folder+"/"+png;var tex=AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);string materialPath=folder+"/IndependentOriginal.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(materialPath);if(mat==null){mat=new Material(shaders);mat.SetColor("_BaseColor",Color.white);mat.SetTexture("_BaseMap",tex);AssetDatabase.CreateAsset(mat,materialPath);}foreach(var r in prop.GetComponentsInChildren<MeshRenderer>())r.sharedMaterial=mat;
  }
  static void Capture(string stage)
  {
   string file="samples/screenshots/"+stage+".png";var target=new RenderTexture(1280,900,24,RenderTextureFormat.ARGB32){antiAliasing=1};var image=new Texture2D(1280,900,TextureFormat.RGB24,false);var old=RenderTexture.active;
   try{camera.targetTexture=target;LE02OffscreenRender.Render(camera);RenderTexture.active=target;image.ReadPixels(new Rect(0,0,1280,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(root,file),image.EncodeToPNG());}
   finally{camera.targetTexture=null;RenderTexture.active=old;UnityEngine.Object.DestroyImmediate(image);UnityEngine.Object.DestroyImmediate(target);}
   var filters=LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>();var bounds=LE01Adapter.Bounds(author);report.steps.Add(new Step{action=stage,status="PASS",hash=session.Current.ContentHash(),mesh=LE01CEvidence.MeshFingerprint(author),image=file,revision=session.Current.State.Revision,ownedColumns=session.Current.State.OwnedColumns.Count,paintRuns=session.Current.State.PaintRuns.Count,triangles=filters.Sum(f=>f.sharedMesh.triangles.Length/3),chunks=filters.Length,bounds=new[]{bounds.center.x,bounds.center.y,bounds.center.z,bounds.size.x,bounds.size.y,bounds.size.z}});
  }
  static void Update()
  {
   try{
    NeedTimeout();session.Tick();
    if(reopening){if(session.Busy||!session.Ready)return;Need(session.Current.ContentHash()==report.authorHash&&LE01CEvidence.MeshFingerprint(author)==report.meshHash,"Separate Engine process restores complete author and actual meshes");Need(prop!=null&&ObjectMeshHash(prop)==report.independentMeshHash,"Separate process retains complete independent original Mesh arrays");Need(prop.transform.parent==null&&MatrixValues(prop.transform.localToWorldMatrix).SequenceEqual(report.independentMatrix),"Separate process retains independent original root and world transform");Need(TextHash(author.GetComponent<LE04TerrainState>().BrushJson)==report.brushJsonSha&&TextHash(JsonUtility.ToJson(session.Settings))==report.brushJsonSha,"Native scene restores exact brush settings into the live session");CheckReferences(session.Current.State,"Native scene");Capture("09-reopened");report.reopened=true;File.WriteAllText(Path.Combine(root,"reports/workflow-reopen.json"),JsonUtility.ToJson(report,true));WritePageData();Stop(true);return;}
    if(phase==0){if(!session.Ready||session.Busy)return;Capture("01-base");SculptSettings();Need(session.BeginAnchor(Top(-2,.4f),Vector3.up),"Fixed actual surface anchor");uploadCount=session.PreviewUploads;phase=1;return;}
    if(phase==1){if(session.PreviewUploads<=uploadCount)return;Need(session.Preview!=null&&!session.Preview.Rejected&&session.Preview.Changed,"Asymmetric anchor candidate changes only its bounded volume");Capture("02-anchor-preview");session.Apply();phase=2;return;}
    if(phase==2){if(session.Busy)return;Capture("03-anchor-applied");var s=session.Settings;s.Tool="paint";s.Paint=new Color(.59f,.67f,.39f,1);s.FaceMask=(int)TerrainFaceMask.PositiveY;s.VisibleOnly=true;s.YAbove=3;s.YBelow=3;s.NegativeX=1;s.PositiveX=2;s.NegativeZ=1;s.PositiveZ=1.5f;Need(session.BeginAnchor(Top(-2,.4f),Vector3.up),"Region paint anchors on visible top");session.Apply();phase=3;return;}
    if(phase==3){if(session.Busy)return;Need(session.Current.State.PaintRuns.Count>0,"Region paint stores generic color independently of volume");Capture("04-region-color");ImportSourcesAndProp();Reference("ridge continuous sweep",0,1,1,1,0,ReferenceBrushMode.Add,new Vector3(-3,0,-1),new Vector3(-1.75f,0,-1.2f),new Vector3(-.5f,0,-.6f));phase=4;return;}
    if(phase==4){if(session.Busy)return;Need(session.Current.State.OwnedColumns.Count>0,"Reference path becomes effective terrain, not placements");Capture("05-ridge-sweep");Reference("stretched terrace continuous sweep",1,1.25f,1,.75f,90,ReferenceBrushMode.Add,new Vector3(1.2f,0,.25f),new Vector3(2.2f,0,.75f),new Vector3(3.2f,0,.5f));phase=5;return;}
    if(phase==5){if(session.Busy)return;Capture("06-stretched-terrace");beforeCut=session.Current.ContentHash();Undo.ClearAll();var side=Side(2.5f,1);Reference("local reference subtract",1,.5f,.5f,.5f,0,ReferenceBrushMode.Subtract,side,side+new Vector3(.5f,0,0));phase=6;return;}
    if(phase==6){if(session.Busy)return;afterCut=session.Current.ContentHash();afterCutMesh=LE01CEvidence.MeshFingerprint(author);Need(afterCut!=beforeCut,"Local reference subtraction changes existing volume");Capture("07-local-subtract");Undo.FlushUndoRecordObjects();phase=7;return;}
    if(phase==7){Undo.PerformUndo();session.Rebuild(true);phase=8;return;}
    if(phase==8){if(session.Busy)return;Need(session.Current.ContentHash()==beforeCut,"One native Undo restores pre-subtraction volume and color");phase=9;return;}
    if(phase==9){Undo.PerformRedo();session.Rebuild(true);phase=10;return;}
    if(phase==10){if(session.Busy)return;Need(session.Current.ContentHash()==afterCut&&LE01CEvidence.MeshFingerprint(author)==afterCutMesh,"One native Redo restores exact subtraction mesh and author");Need(prop.transform.parent==null&&prop.transform.localToWorldMatrix==propMatrix&&ObjectMeshHash(prop)==propHash,"Independent original root, mesh and placement remain unchanged through all A operations");Capture("08-final");Save();report.status="PASS";File.WriteAllText(Path.Combine(root,"reports/workflow-evidence.json"),JsonUtility.ToJson(report,true));WritePageData();Stop(true);return;}
   }catch(Exception e){report.status="FAIL";report.error=e.ToString();File.WriteAllText(Path.Combine(root,"reports/workflow-evidence.json"),JsonUtility.ToJson(report,true));WritePageData();UnityEngine.Debug.LogException(e);Stop(false);}
  }
  static void Save()
  {
   LE04TerrainFiles.Save(author,Path.Combine(root,report.completeFile));LE04TerrainFiles.SaveScene(author,Scene);AssetDatabase.SaveAssets();
   LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(root,report.export));var palette=LE04TerrainFiles.ExportPalette(author);File.Copy(AssetDatabase.GetAssetPath(palette),Path.Combine(root,"exports/LE04_Workflow.palette.png"),true);
   report.authorHash=session.Current.ContentHash();report.meshHash=LE01CEvidence.MeshFingerprint(author);report.brushJsonSha=TextHash(author.GetComponent<LE04TerrainState>().BrushJson);Need(session.Current.State.References.Count==2,"Complete scene embeds both actual sampled reference sources");
   foreach(var reference in session.Current.State.References)report.references.Add(new ReferenceProof{id=reference.Id,sourceHash=reference.SourceHash,inputFileSha=FileHash(reference.SourcePath),snapshotSha=TextHash(JsonUtility.ToJson(reference.Asset)),voxels=reference.Asset.voxels.Count,palette=reference.Asset.palette.Count});
  }
  static void CheckReferences(TerrainEditState state,string origin)
  {Need(state.References.Count==report.references.Count,origin+" keeps every cached reference snapshot");foreach(var proof in report.references){var record=state.References.SingleOrDefault(r=>r.Id==proof.id&&r.SourceHash==proof.sourceHash);Need(record!=null&&TextHash(JsonUtility.ToJson(record.Asset))==proof.snapshotSha&&record.Asset.voxels.Count==proof.voxels&&record.Asset.palette.Count==proof.palette,origin+" keeps exact reference shape, face colors and source identity: "+proof.id);Need(FileHash(record.SourcePath)==proof.inputFileSha,origin+" original reference input bytes unchanged: "+proof.id);}}
  static void NeedTimeout(){if(EditorApplication.timeSinceStartup-started>180)throw new TimeoutException("Workflow candidate did not settle: "+session.Status);}
  static void WritePageData(){Directory.CreateDirectory(Path.Combine(root,"review"));File.WriteAllText(Path.Combine(root,"review/evidence-data.js"),"window.LE04_EVIDENCE="+JsonUtility.ToJson(report)+";\n");}
  static void Stop(bool success){EditorApplication.update-=Update;LE04TerrainSession.Forget(author);UnityEngine.Debug.Log("LE04_EVIDENCE_COMPLETE "+(success?"PASS":"FAIL"));EditorApplication.Exit(success?0:1);}
  public static void Reopen()
  {
   Begin();report=JsonUtility.FromJson<Report>(File.ReadAllText(Path.Combine(root,"reports/workflow-evidence.json")));Need(report.status=="PASS","Prior actual workflow succeeded");EditorSceneManager.OpenScene(Scene);author=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();camera=UnityEngine.Object.FindObjectOfType<Camera>();prop=GameObject.Find("IndependentOriginal_Ridge_NotABuildingTool");Need(author!=null&&camera!=null,"Native workscene restores terrain and camera");Need(LE01CEvidence.MeshFingerprint(author)==report.meshHash,"Persistent scene owns correct meshes before recomputation");var file=LE04TerrainFiles.Read(File.ReadAllText(Path.Combine(root,report.completeFile)));Need(TerrainEffectiveSource.Capture(file.terrain,file.editState).ContentHash()==report.authorHash,"Complete v2 file matches native scene");Need(TextHash(file.brushJson)==report.brushJsonSha,"Complete v2 file preserves every brush parameter");CheckReferences(file.editState,"Complete v2 file");session=LE04TerrainSession.Get(author);reopening=true;EditorApplication.update+=Update;
  }
 }
}
