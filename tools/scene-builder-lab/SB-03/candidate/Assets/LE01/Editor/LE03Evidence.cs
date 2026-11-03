using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    // Research fixtures operate through the actual Core/Adapter and render the
    // resulting Unity meshes. They do not claim physical mouse or GUI timings.
    public static class LE03Evidence
    {
        public const string CoreScenePath="Assets/LE03/Scenes/StructurePlayground_719.unity";
        public const string ModuleScenePath="Assets/LE03/Scenes/ModuleStructurePlayground_719.unity";
        public static string Root {get{string configured=Environment.GetEnvironmentVariable("LE03_OUTPUT_ROOT");return string.IsNullOrEmpty(configured)?LE01CStart.CurrentRoot:Path.GetFullPath(configured);}}
        [Serializable] public sealed class Check {public string name,status,detail;}
        [Serializable] public sealed class Frame
        {
            public string name,path,native,authorHash,meshHash,theme;public int ruleVersion,triangles,leaves;public float[] cameraPosition,cameraEuler,focusCenter,focusSize;public string scope="Actual Unity mesh render, fixed camera; no proxy geometry.";
        }
        [Serializable] public sealed class Sample
        {
            public string name,native,authorHash,meshHash,moduleLayerHash,paletteHash;public int ruleVersion,triangles,anchors,missingWallKeys,placements,paletteEntries;public Audit audit;
        }
        [Serializable] public sealed class KitSource {public string assetId,sourceHash,jsonFile,blendFile,blendHash;public int[] size;public int voxels;}
        [Serializable] public sealed class Usage {public string assetId,sourceHash;public int instances,visibleTriangles;}
        [Serializable] public sealed class Composition {public string name;public int placements,moduleVoxels,affectedColumns,coveredJointSnowTriangles,jointSideTriangles;public float[] jointBounds;public List<Usage> sources=new List<Usage>();}
        [Serializable] sealed class KitFile {public List<VoxelModuleAsset> assets=new List<VoxelModuleAsset>();}
        [Serializable] sealed class PaletteFile {public List<VoxelPaletteEntry> entries;}
        [Serializable] sealed class DeliveryAsset {public string path,guid,kind,metaSha256,sourceSha256,packageName,packageVersion,resolvedPackageVersion;public bool exists,mainObject;public List<string> unresolved=new List<string>();}
        [Serializable] sealed class DeliveryScene {public string path,guid;public int objects,missingScripts,missingObjects,meshFilters;public string[] dependencies;public List<string> errors=new List<string>();}
        [Serializable] sealed class DeliveryReport {public string status="FAIL",engine,utc,sourceHash,packageLockPath,packageLockSha256,scope="Only Assets/LE03 research Scenes and ModuleKit, plus their explicit dependency closure; canonical GUIDs come from AssetDatabase, opaque Tuanjie meta files are bound by SHA256. No formal-project scan or asset writes.";public List<Check> checks=new List<Check>();public List<DeliveryScene> scenes=new List<DeliveryScene>();public List<DeliveryAsset> assets=new List<DeliveryAsset>();}
        [Serializable] public sealed class Report
        {
            public string status="FAIL",engine,utc,sourceHash,shaderHash,authorHash,meshHash,native,scene,moduleLayerHash,paletteHash;
            public string scope="Actual Unity Mesh/Collider/URP renders and controlled Core commands, native files, FBX and persisted Scene. Module examples use a fixed authored placement list, not automatic layout. Not physical mouse replay, GUI frame timing or an aesthetic approval.";
            public List<Check> checks=new List<Check>();public List<Frame> images=new List<Frame>();public List<Sample> samples=new List<Sample>();public List<KitSource> sources=new List<KitSource>();public List<Composition> compositions=new List<Composition>();
        }
        [Serializable] public sealed class Audit
        {
            public int triangles,degenerate,duplicates,offGrid,badCoverage,badDirection;public double signedVolume;public bool closed;
        }
        struct EdgeKey:IEquatable<EdgeKey>
        {
            internal Vector3Int a,b;
            public bool Equals(EdgeKey k){return a==k.a&&b==k.b;}public override bool Equals(object k){return k is EdgeKey&&Equals((EdgeKey)k);}public override int GetHashCode(){unchecked{return a.GetHashCode()*397^b.GetHashCode();}}
        }
        struct EdgeUse {internal int count,direction;}
        static Report report;static LE01TerrainAuthor author;static string currentNative;
        static string HashBytes(byte[] bytes){using(var sha=System.Security.Cryptography.SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}static string Hash(string text){return HashBytes(System.Text.Encoding.UTF8.GetBytes(text));}
        static int Compare(Vector3Int a,Vector3Int b){int result=a.x.CompareTo(b.x);if(result==0)result=a.y.CompareTo(b.y);if(result==0)result=a.z.CompareTo(b.z);return result;}
        static int Gcd(int a,int b){a=Math.Abs(a);b=Math.Abs(b);while(b!=0){int next=a%b;a=b;b=next;}return a;}
        static void AddEdge(Dictionary<EdgeKey,EdgeUse> edges,Vector3Int a,Vector3Int b)
        {
            var delta=b-a;int count=Gcd(Gcd(delta.x,delta.y),delta.z);if(count==0)return;var step=new Vector3Int(delta.x/count,delta.y/count,delta.z/count);
            for(int i=0;i<count;i++){var p=a+step*i;var q=p+step;bool forward=Compare(p,q)<0;var key=new EdgeKey{a=forward?p:q,b=forward?q:p};EdgeUse use;edges.TryGetValue(key,out use);use.count++;use.direction+=forward?1:-1;edges[key]=use;}
        }
        static Audit AuditMeshes(GameObject geometry)
        {
            var result=new Audit();var edges=new Dictionary<EdgeKey,EdgeUse>();var unique=new HashSet<string>();
            foreach(var filter in geometry.GetComponentsInChildren<MeshFilter>())
            {
                var mesh=filter.sharedMesh;var points=mesh.vertices;var grid=new Vector3Int[points.Length];for(int i=0;i<points.Length;i++){var world=filter.transform.TransformPoint(points[i]);grid[i]=Vector3Int.RoundToInt(world/TerrainUnits.Unit);if((world-(Vector3)grid[i]*TerrainUnits.Unit).sqrMagnitude>1e-10f)result.offGrid++;}
                var triangles=mesh.triangles;for(int i=0;i<triangles.Length;i+=3)
                {
                    var a=grid[triangles[i]];var b=grid[triangles[i+1]];var c=grid[triangles[i+2]];result.triangles++;if(Vector3.Cross((Vector3)(b-a),(Vector3)(c-a)).sqrMagnitude<.0001f)result.degenerate++;
                    var sorted=new[]{a,b,c};Array.Sort(sorted,(x,y)=>Compare(x,y));string key=sorted[0]+"/"+sorted[1]+"/"+sorted[2];if(!unique.Add(key))result.duplicates++;AddEdge(edges,a,b);AddEdge(edges,b,c);AddEdge(edges,c,a);
                    result.signedVolume+=((double)a.x*((double)b.y*c.z-(double)b.z*c.y)+(double)a.y*((double)b.z*c.x-(double)b.x*c.z)+(double)a.z*((double)b.x*c.y-(double)b.y*c.x))*Math.Pow(TerrainUnits.Unit,3)/6;
                }
            }
            foreach(var edge in edges.Values){if(edge.count!=2)result.badCoverage++;if(edge.direction!=0)result.badDirection++;}result.closed=result.degenerate==0&&result.duplicates==0&&result.offGrid==0&&result.badCoverage==0&&result.badDirection==0&&result.signedVolume>0;return result;
        }
        static void Require(bool condition,string name,string detail="")
        {report.checks.Add(new Check{name=name,status=condition?"PASS":"FAIL",detail=detail});if(!condition)throw new InvalidOperationException(name+": "+detail);}
        static void Begin(string scene)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("LE03 evidence requires the isolated background QA project.");foreach(string path in new[]{"reports","samples/native","samples/screenshots","exports"})Directory.CreateDirectory(Path.Combine(Root,path));report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash(),shaderHash=LE02Evidence.ShaderHash(),scene=scene};
        }
        static void SaveReport(string name){File.WriteAllText(Path.Combine(Root,"reports/"+name+".json"),JsonUtility.ToJson(report,true));}
        static LE01TerrainAuthor NewAuthor()
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.66f,.69f,.72f);RenderSettings.skybox=null;RenderSettings.fog=false;
            var light=new GameObject("LE03_Daylight").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.15f;light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(38,-38,0);
            var go=new GameObject("LE03_StructureTerrain");return go.AddComponent<LE01TerrainAuthor>();
        }
        static TerrainDocument Cliff()
        {
            var d=new TerrainDocument{Id="LE03_Structure_719",GeneratorVersion="le01.3",SculptSchemaVersion=2,BaseHeight=-80,ActiveQuantum=4,Seed=719};
            for(int x=-64;x<64;x+=4)for(int z=-48;z<32;z+=4)d.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=z<-32?-40:0,PlaneId=z<-32?"lower":"p0"});return d;
        }
        static TerrainDocument Flat()
        {
            var d=new TerrainDocument{Id="LE03_Height_719",GeneratorVersion="le01.3",SculptSchemaVersion=2,BaseHeight=-16,ActiveQuantum=4,Seed=719};for(int x=-64;x<64;x+=4)for(int z=-64;z<64;z+=4)d.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=0,PlaneId="p0"});return Adopt(d);
        }
        static TerrainDocument Adopt(TerrainDocument source){var result=TerrainRuleStyles.Adopt(source);Require(!result.Rejected&&result.Changed,"explicit unedited-copy adoption",result.Message);return result.Document;}
        static TerrainDocument Commit(TerrainDocument source,TerrainCommand command)
        {
            var result=TerrainKernel.Apply(source,command);Require(!result.Rejected&&result.Changed,"controlled Core command "+command.Mode,result.Message);result.Document.Revision=source.Revision+1;return result.Document;
        }
        static TerrainDocument Height(TerrainDocument source,TerrainHeightForm form,float x=0,float z=0,float strength=1.75f,float radius=.75f,float falloff=1.5f,float rotation=32,float aspect=1.65f)
        {return Commit(source,new TerrainCommand{Mode=BrushMode.SmoothRaise,Path={new Point2(x,z)},Radius=radius,Falloff=falloff,Strength=strength,Quantum=2,HeightForm=form,RotationDegrees=rotation,AspectRatio=aspect});}
        static void Set(TerrainDocument document)
        {
            author.Write(document.Copy());author.Gray=false;var build=TerrainCompiler.Build(author.Read());foreach(var chunk in build.Chunks)Require(chunk.TriangleBoundaryKeys!=null&&chunk.TriangleBoundaryKeys.Length==chunk.Triangles.Length/3,"triangle metadata aligned "+chunk.Id);LE01Adapter.Upload(author,build,true,true);Physics.SyncTransforms();currentNative=null;
        }
        static SurfaceHit Pick(float x,float y)
        {
            SurfaceHit hit;string message;Require(LE01Adapter.TryPickSculpt(author,new Ray(new Vector3(x,y,-14),Vector3.forward),out hit,out message),"actual visible side hit",message);Require(!string.IsNullOrEmpty(hit.BoundaryKey),"side hit binds native boundary key");return hit;
        }
        static TerrainDocument Shape(TerrainDocument source,float x,float y,float radius,float strength,SculptInfluence influence,string id,out SculptSelection selected)
        {
            Set(source);var hit=Pick(x,y);selected=TerrainStructures.ResolveShapeHit(source,hit,radius,influence,-36,-6);Require(selected.Valid,"visible wall selection",selected.Message);var document=Commit(source,new TerrainCommand{Mode=BrushMode.SculptShape,Selection=selected,Strength=strength,EditId=id});selected=selected.Copy();selected.SourceRevision=document.Revision;return document;
        }
        static void Native(string name)
        {
            currentNative="samples/native/"+name+".leterrain.json";LE01Adapter.NativeSave(author,Path.Combine(Root,currentNative));var loaded=LE01Adapter.NativeLoad(Path.Combine(Root,currentNative));Require(TerrainQueries.ContentHash(loaded)==TerrainQueries.ContentHash(author.Read()),"native author roundtrip "+name);
            var audit=AuditMeshes(LE01Adapter.Geometry(author));Require(audit.closed,"actual Unity mesh closed "+name,JsonUtility.ToJson(audit));int keys=0,missing=0;foreach(var filter in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>()){var map=LE01Adapter.SurfaceBoundaryKeys(author,filter);var mesh=filter.sharedMesh;var indices=mesh.triangles;var normals=mesh.normals;Require(map!=null&&map.Length==indices.Length/3,"actual mesh metadata aligned "+name);for(int i=0;i<map.Length;i++){if(!string.IsNullOrEmpty(map[i]))keys++;else if(Math.Abs(normals[indices[i*3]].y)<.5f)missing++;}}
            report.samples.Add(new Sample{name=name,native=currentNative,authorHash=TerrainQueries.ContentHash(author.Read()),meshHash=LE01CEvidence.MeshFingerprint(author),ruleVersion=author.Read().RockRuleVersion,triangles=audit.triangles,anchors=keys,missingWallKeys=missing,audit=audit});
        }
        static Vector3[] Corners(Bounds b){var corners=new Vector3[8];int i=0;foreach(int x in new[]{-1,1})foreach(int y in new[]{-1,1})foreach(int z in new[]{-1,1})corners[i++]=b.center+Vector3.Scale(b.extents,new Vector3(x,y,z));return corners;}
        static void Configure(Camera camera,Bounds focus,Vector3 angles)
        {
            camera.orthographic=true;camera.allowHDR=false;camera.allowMSAA=false;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.64f,.72f,.79f);camera.aspect=1200f/900;camera.transform.rotation=Quaternion.Euler(angles);float width=0,height=0;var inverse=Quaternion.Inverse(camera.transform.rotation);foreach(var p in Corners(focus)){var relative=inverse*(p-focus.center);width=Math.Max(width,Math.Abs(relative.x));height=Math.Max(height,Math.Abs(relative.y));}camera.orthographicSize=Math.Max(height,width/camera.aspect)*1.08f;camera.transform.position=focus.center-camera.transform.forward*40;camera.nearClipPlane=.1f;camera.farClipPlane=100;
        }
        static void Capture(string name,Bounds focus,Vector3 angles,Action overlay=null)
        {
            Require(currentNative!=null,"capture has native source "+name);var go=new GameObject("LE03_OffscreenCamera");var camera=go.AddComponent<Camera>();var target=new RenderTexture(1200,900,24,RenderTextureFormat.ARGB32){antiAliasing=1};var pixels=new Texture2D(1200,900,TextureFormat.RGB24,false);var previous=RenderTexture.active;
            try{Configure(camera,focus,angles);camera.targetTexture=target;LE02OffscreenRender.Render(camera,overlay);RenderTexture.active=target;pixels.ReadPixels(new Rect(0,0,1200,900),0,0);pixels.Apply();string relative="samples/screenshots/"+name+".png";File.WriteAllBytes(Path.Combine(Root,relative),pixels.EncodeToPNG());var d=author.Read();report.images.Add(new Frame{name=name,path=relative,native=currentNative,authorHash=TerrainQueries.ContentHash(d),meshHash=LE01CEvidence.MeshFingerprint(author),theme=d.TerrainThemeId,ruleVersion=d.RockRuleVersion,leaves=d.Cells.Count,triangles=LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>().Sum(f=>f.sharedMesh.triangles.Length/3),cameraPosition=new[]{camera.transform.position.x,camera.transform.position.y,camera.transform.position.z},cameraEuler=new[]{angles.x,angles.y,angles.z},focusCenter=new[]{focus.center.x,focus.center.y,focus.center.z},focusSize=new[]{focus.size.x,focus.size.y,focus.size.z}});}
            finally{camera.targetTexture=null;RenderTexture.active=previous;UnityEngine.Object.DestroyImmediate(pixels);UnityEngine.Object.DestroyImmediate(target);UnityEngine.Object.DestroyImmediate(go);}
        }
        static void ShowSample(TerrainDocument d,string name,Bounds focus,Vector3 angles){Set(d);Native(name);Capture(name,focus,angles);}
        public static void BuildCoreExamples()
        {
            Begin(CoreScenePath);
            try
            {
                author=NewAuthor();var legacy=Cliff();var structured=Adopt(legacy);var focus=new Bounds(new Vector3(0,-2.1f,-.5f),new Vector3(9,5.8f,6.4f));var oblique=new Vector3(24,-30,0);var side=Vector3.zero;
                ShowSample(legacy,"01-wall-legacy",focus,oblique);ShowSample(structured,"02-wall-structure",focus,oblique);LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(Root,"exports/StructureRules_719.fbx"));
                var rootFocus=new Bounds(new Vector3(0,-2.5f,-1.8f),new Vector3(3.6f,1.4f,1.6f));ShowSample(legacy,"03-root-legacy",rootFocus,new Vector3(18,-20,0));ShowSample(structured,"04-root-structure",rootFocus,new Vector3(18,-20,0));
                var flat=Flat();var hillFocus=new Bounds(new Vector3(0,.4f,0),new Vector3(8.6f,3.1f,8.6f));foreach(var form in new[]{TerrainHeightForm.RoundTerrace,TerrainHeightForm.Mound,TerrainHeightForm.Ridge,TerrainHeightForm.Slope}){var shaped=Height(flat,form);string name="height-"+form.ToString().ToLowerInvariant();ShowSample(shaped,name,hillFocus,new Vector3(35,-35,0));if(form==TerrainHeightForm.Ridge)LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(Root,"exports/DirectionalRidge_719.fbx"));}
                SculptSelection selection;var bag=Shape(legacy,0,-1.3f,2.4f,.75f,SculptInfluence.HeightRange,"legacy-middle",out selection);ShowSample(bag,"05-middle-legacy",focus,oblique);Capture("05-middle-legacy-front",focus,side);
                var column=Shape(structured,0,-1.3f,2.4f,.75f,SculptInfluence.HeightRange,"structure-middle",out selection);ShowSample(column,"06-middle-structure",focus,oblique);Capture("06-middle-structure-front",focus,side);
                foreach(bool shoulder in new[]{false,true}){float x=shoulder?2.1f:-2.1f,y=shoulder?-.45f:-1.3f;string name=shoulder?"08-local-shoulder":"07-local-middle";var local=Shape(structured,x,y,.65f,.65f,SculptInfluence.LocalSurface,name,out selection);Set(local);Native(name);Capture(name,focus,oblique);var frozen=selection.Copy();Capture(name+"-range",focus,oblique,()=>LE02BrushOverlay.DrawSculpt(author,frozen,filter=>LE01Adapter.SurfaceBoundaryKeys(author,filter),false,requireSceneRepaint:false));}
                ShowSample(structured,"09-theme-stone",focus,oblique);var snow=TerrainRuleStyles.Theme(structured,"snow-rock");Require(!snow.Rejected&&snow.Changed,"explicit snow-rock theme");ShowSample(snow.Document,"10-theme-snow-rock",focus,oblique);
                var playground=Height(structured,TerrainHeightForm.Ridge,-2,.6f,.75f,.3f,.8f,0,1.4f);playground=Shape(playground,1.7f,-1.2f,1.1f,.65f,SculptInfluence.HeightRange,"playground-middle",out selection);playground=Shape(playground,-1.8f,-.45f,.5f,-.25f,SculptInfluence.LocalSurface,"playground-shoulder",out selection);playground.TerrainThemeId="snow-rock";ShowSample(playground,"StructurePlayground_719",focus,oblique);
                report.authorHash=TerrainQueries.ContentHash(author.Read());report.native=currentNative;LE01Adapter.SaveSceneMeshes(author,CoreScenePath);report.meshHash=LE01CEvidence.MeshFingerprint(author);report.status="PASS";
            }
            catch(Exception error){report.checks.Add(new Check{name="uncaught",status="FAIL",detail=error.ToString()});throw;}
            finally{SaveReport("core-visual-evidence");AssetDatabase.SaveAssets();LE02BrushOverlay.Release();}Debug.Log("LE03_CORE_EVIDENCE_COMPLETE");
        }
        public static void Reopen()
        {
            var old=JsonUtility.FromJson<Report>(File.ReadAllText(Path.Combine(Root,"reports/core-visual-evidence.json")));Begin(CoreScenePath);
            try{Require(report.sourceHash==old.sourceHash&&report.shaderHash==old.shaderHash,"same implementation and shader source on core reopen");EditorSceneManager.OpenScene(CoreScenePath);author=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();Require(author!=null,"new process opens structure author");Require(TerrainQueries.ContentHash(author.Read())==old.authorHash,"persisted scene author matches");Require(LE01CEvidence.MeshFingerprint(author)==old.meshHash,"persisted actual Unity mesh arrays match");Require(TerrainQueries.ContentHash(LE01Adapter.NativeLoad(Path.Combine(Root,old.native)))==old.authorHash,"persisted native author matches");Require(author.Read().RockRuleVersion==1&&author.Read().TerrainThemeId=="snow-rock","rule and theme persist");Require(author.Read().SculptOverrides.Any(e=>e.LocalMask==SculptLocalMask.StructurePatch&&e.Version==3&&e.ShapeProfileVersion==1),"new planar structural patch persists");var hit=Pick(1.7f,-1.2f);var next=TerrainStructures.ResolveShapeHit(author.Read(),hit,.3f,SculptInfluence.LocalSurface,-80,0);Require(next.Valid&&next.LocalMask==SculptLocalMask.StructurePatch&&next.Anchors.All(a=>a.PatchMinHeight<a.PatchMaxHeight),"reopened real side supports continued structural local picking");Native("StructurePlayground_719_reopened");report.authorHash=old.authorHash;report.meshHash=old.meshHash;report.native=old.native;report.status="PASS";}
            catch(Exception error){report.checks.Add(new Check{name="uncaught",status="FAIL",detail=error.ToString()});throw;}
            finally{SaveReport("core-reopen-evidence");}Debug.Log("LE03_CORE_REOPEN_COMPLETE");
        }
        static Dictionary<string,VoxelModuleAsset> LoadKit()
        {
            var result=new Dictionary<string,VoxelModuleAsset>();string kit=Path.Combine(Root,"kit");string aggregate=Path.Combine(kit,"kit6.voxel.json");
            if(File.Exists(aggregate)){var file=JsonUtility.FromJson<KitFile>(File.ReadAllText(aggregate));if(file!=null&&file.assets!=null)foreach(var asset in file.assets)result[asset.assetId]=asset;}
            foreach(string file in Directory.GetFiles(kit,"*.voxel.json",SearchOption.AllDirectories).Where(p=>Path.GetFileName(p)!="kit6.voxel.json").OrderBy(p=>p))
            {
                var asset=JsonUtility.FromJson<VoxelModuleAsset>(File.ReadAllText(file));string error;Require(VoxelModules.ValidateAsset(asset,out error),"actual kit data certified "+Path.GetFileName(file),error);result[asset.assetId]=asset;string blend=file.Substring(0,file.Length-".voxel.json".Length)+".blend";report.sources.Add(new KitSource{assetId=asset.assetId,sourceHash=asset.sourceHash,jsonFile=file,blendFile=File.Exists(blend)?blend:null,blendHash=File.Exists(blend)?HashBytes(File.ReadAllBytes(blend)):null,size=asset.size,voxels=asset.voxels.Count});
            }
            Require(result.Count==6,"six real workshop modules are available",string.Join(",",result.Keys));return result;
        }
        static TerrainDocument ModuleBase(bool empty=false)
        {
            var d=new TerrainDocument{Id="LE03_ModuleStructure_719",GeneratorVersion="le01.3",SculptSchemaVersion=2,RockRuleVersion=1,TerrainThemeId="snow-rock",BaseHeight=-8,ActiveQuantum=4,Seed=719};
            if(!empty)for(int x=-16;x<16;x+=4)for(int z=-8;z<8;z+=4)d.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=x>=-8&&x<8&&z>=-4&&z<4?16:0,PlaneId="module-base"});return d;
        }
        static void PrepareModuleAuthor(TerrainDocument terrain,IEnumerable<VoxelModuleAsset> sources)
        {
            author=NewAuthor();author.name="LE03_ModuleStructureTerrain";Set(terrain);LE03Modules.GetOrCreate(author);foreach(var asset in sources)Require(LE03Modules.Import(author,asset),"import actual source "+asset.assetId,LE03Modules.Status(author));
        }
        static void Place(VoxelModuleAsset asset,string id,int x,int y,int z,int yaw=0)
        {
            Require(LE03Modules.Place(author,new VoxelPlacement{id=id,assetId=asset.assetId,assetVersion=asset.assetVersion,sourceHash=asset.sourceHash,x=x,y=y,z=z,yaw=yaw,replaceBase=true}),"queue complete module "+id,LE03Modules.Status(author));Require(LE03Modules.Drain(author,30000),"commit complete module "+id,LE03Modules.Status(author));
        }
        static void RequireDisplayed(VoxelWorldBuild build,string name)
        {
            var filters=LE01Adapter.Geometry(author).GetComponentsInChildren<MeshFilter>().ToDictionary(f=>f.sharedMesh.name);int expected=0;foreach(var data in build.geometry.Chunks.Where(c=>c.Triangles.Length>0))
            {
                MeshFilter filter;Require(filters.TryGetValue(data.Id,out filter),"displayed composed chunk "+name+" "+data.Id);var mesh=filter.sharedMesh;var vertices=mesh.vertices;var normals=mesh.normals;var uv=mesh.uv;Require(vertices.Length*3==data.Vertices.Length&&mesh.triangles.SequenceEqual(data.Triangles),"displayed indices equal composed data "+name);
                for(int i=0;i<vertices.Length;i++)if(vertices[i].x!=data.Vertices[i*3]||vertices[i].y!=data.Vertices[i*3+1]||vertices[i].z!=data.Vertices[i*3+2]||normals[i].x!=data.Normals[i*3]||normals[i].y!=data.Normals[i*3+1]||normals[i].z!=data.Normals[i*3+2]||uv[i].x!=data.UV[i*2]||uv[i].y!=data.UV[i*2+1])throw new InvalidOperationException("Displayed composed vertex/normal/UV differs from actual module result: "+name);expected++;
            }
            Require(expected==filters.Count,"no proxy chunks in module display "+name);foreach(var renderer in LE01Adapter.Geometry(author).GetComponentsInChildren<MeshRenderer>())
            {
                var texture=renderer.sharedMaterial.GetTexture("_BaseMap") as Texture2D;Require(texture!=null&&texture.width==build.palette.Count,"actual mixed palette width "+name);var pixels=texture.GetPixels();for(int i=0;i<build.palette.Count;i++){var color=build.palette[i].rgba;Require(Math.Abs(pixels[i].r-color[0])<=1.01f/255&&Math.Abs(pixels[i].g-color[1])<=1.01f/255&&Math.Abs(pixels[i].b-color[2])<=1.01f/255,"actual mixed palette color "+name+" "+i);}
            }
        }
        static VoxelWorldBuild ModuleNative(string name,bool joint=false,float jointZ=0)
        {
            Require(!LE03Modules.Busy(author),"module evidence has no pending transaction");var build=LE03Modules.BuildForEvidence(author);Require(build.geometry.ModuleComposed,"actual world result is composed "+name);RequireDisplayed(build,name);currentNative="samples/native/"+name+".leworld.json";LE01Adapter.NativeSave(author,Path.Combine(Root,currentNative));var file=JsonUtility.FromJson<VoxelWorldFile>(File.ReadAllText(Path.Combine(Root,currentNative)));var layer=LE03Modules.GetOrCreate(author).Read();string layerHash=Hash(JsonUtility.ToJson(layer)),paletteHash=Hash(JsonUtility.ToJson(new PaletteFile{entries=build.palette}));Require(file.terrain!=null&&file.layer!=null&&TerrainQueries.ContentHash(file.terrain)==TerrainQueries.ContentHash(author.Read())&&Hash(JsonUtility.ToJson(file.layer))==layerHash,"native world is self-contained "+name);var audit=AuditMeshes(LE01Adapter.Geometry(author));Require(audit.closed,"actual composed mesh closed "+name,JsonUtility.ToJson(audit));
            var composition=new Composition{name=name,placements=layer.placements.Count,moduleVoxels=build.moduleVoxels,affectedColumns=build.affectedColumns};foreach(var source in layer.assets)composition.sources.Add(new Usage{assetId=source.assetId,sourceHash=source.sourceHash,instances=layer.placements.Count(p=>VoxelModules.AssetKey(p)==VoxelModules.AssetKey(source)),visibleTriangles=build.geometry.Chunks.Sum(c=>c.TriangleChildIds.Count(s=>s==source.assetId))});
            if(joint){composition.jointBounds=new[]{-2f,2.5f,jointZ,0f,2.75f,jointZ+1.5f};foreach(var chunk in build.geometry.Chunks)for(int i=0;i<chunk.Triangles.Length;i+=3){int a=chunk.Triangles[i],b=chunk.Triangles[i+1],c=chunk.Triangles[i+2];float x=(chunk.Vertices[a*3]+chunk.Vertices[b*3]+chunk.Vertices[c*3])/3,y=(chunk.Vertices[a*3+1]+chunk.Vertices[b*3+1]+chunk.Vertices[c*3+1])/3,z=(chunk.Vertices[a*3+2]+chunk.Vertices[b*3+2]+chunk.Vertices[c*3+2])/3;float minY=Math.Min(chunk.Vertices[a*3+1],Math.Min(chunk.Vertices[b*3+1],chunk.Vertices[c*3+1])),maxY=Math.Max(chunk.Vertices[a*3+1],Math.Max(chunk.Vertices[b*3+1],chunk.Vertices[c*3+1]));if(x>=-2.001f&&x<=.001f&&z>=jointZ-.001f&&z<=jointZ+1.501f&&minY<2.749f&&maxY>2.501f&&Math.Abs(chunk.Normals[a*3+1])<.5f){composition.jointSideTriangles++;int material=Mathf.Clamp(Mathf.FloorToInt(chunk.UV[a*2]*build.palette.Count),0,build.palette.Count-1);if(build.palette[material].role=="snow")composition.coveredJointSnowTriangles++;}}Require(composition.jointSideTriangles>0,"actual side geometry crosses the covered joint "+name);Require(composition.coveredJointSnowTriangles==0,"covered lower snow cap is rock at actual stack joint "+name,composition.coveredJointSnowTriangles.ToString());}
            report.compositions.Add(composition);report.samples.Add(new Sample{name=name,native=currentNative,authorHash=TerrainQueries.ContentHash(author.Read()),meshHash=LE01CEvidence.MeshFingerprint(author),moduleLayerHash=layerHash,paletteHash=paletteHash,ruleVersion=author.Read().RockRuleVersion,triangles=audit.triangles,placements=layer.placements.Count,paletteEntries=build.palette.Count,audit=audit});return build;
        }
        public static void BuildModuleExamples()
        {
            Begin(ModuleScenePath);
            try
            {
                var kit=LoadKit();foreach(var source in kit.Values.OrderBy(a=>a.assetId)){PrepareModuleAuthor(ModuleBase(true),new[]{source});Place(source,"source-preview",-source.size[0]/2,0,-source.size[2]/2);string name="source-"+source.assetId.Replace("snowrock.","");ModuleNative(name);Capture(name,LE01Adapter.Bounds(author),new Vector3(24,-32,0));}
                var basis=ModuleBase();var focus=new Bounds(new Vector3(0,2.2f,0),new Vector3(9,7,5.2f));var angles=new Vector3(25,-32,0);var main=kit["snowrock.main-column"];PrepareModuleAuthor(basis,kit.Values);ModuleNative("11-module-base-only");Capture("11-module-base-only",focus,angles);int row=0;foreach(int z in new[]{-8,-2,2}){int column=0;foreach(int x in new[]{-16,-8,0,8})Place(main,"repeat-"+row+"-"+(column++),x,0,z);row++;}Place(main,"repeat-upper",-8,11,0);ModuleNative("11-one-mother-repeat",true);Capture("11-one-mother-repeat",focus,angles);Capture("11-one-mother-joint",new Bounds(new Vector3(-1,2.75f,.5f),new Vector3(3.2f,1.4f,2.8f)),new Vector3(0,-25,0));LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(Root,"exports/OneMotherRepeat_719.fbx"));
                PrepareModuleAuthor(basis,kit.Values);Place(kit["snowrock.outer-corner"],"designed-back-left",-16,0,0);Place(main,"designed-back-main",-8,0,2);Place(kit["snowrock.shoulder-terrace"],"designed-back-shoulder",0,0,0);Place(kit["snowrock.outer-corner"],"designed-back-right",8,0,0,1);Place(kit["snowrock.low-terrace"],"designed-front-left",-16,0,-8);Place(kit["snowrock.connector-cap"],"designed-front-link",-8,0,-6,1);Place(kit["snowrock.inner-corner"],"designed-front-inner",0,0,-8);Place(kit["snowrock.low-terrace"],"designed-front-right",8,0,-8);Place(main,"designed-upper-main",-8,11,2);ModuleNative("12-role-composition",true,.5f);Capture("12-role-composition",focus,angles);Capture("12-role-joint",new Bounds(new Vector3(-1,2.75f,.5f),new Vector3(3.2f,1.4f,2.8f)),new Vector3(0,-25,0));Capture("12-role-corner",new Bounds(new Vector3(1,1.1f,-1),new Vector3(3.2f,3.2f,3.6f)),new Vector3(24,-32,0));LE01Export.Export(LE01Adapter.Geometry(author),Path.Combine(Root,"exports/RoleComposition_719.fbx"));
                var final=report.samples.Last();report.native=currentNative;report.authorHash=final.authorHash;report.moduleLayerHash=final.moduleLayerHash;report.paletteHash=final.paletteHash;LE01Adapter.SaveSceneMeshes(author,ModuleScenePath);report.meshHash=LE01CEvidence.MeshFingerprint(author);report.status="PASS";
            }
            catch(Exception error){report.checks.Add(new Check{name="uncaught",status="FAIL",detail=error.ToString()});throw;}
            finally{SaveReport("module-visual-evidence");AssetDatabase.SaveAssets();}Debug.Log("LE03_MODULE_EVIDENCE_COMPLETE");
        }
        public static void ReopenModules()
        {
            var old=JsonUtility.FromJson<Report>(File.ReadAllText(Path.Combine(Root,"reports/module-visual-evidence.json")));Begin(ModuleScenePath);
            try{Require(report.sourceHash==old.sourceHash&&report.shaderHash==old.shaderHash,"same implementation and shader source on module reopen");EditorSceneManager.OpenScene(ModuleScenePath);author=UnityEngine.Object.FindObjectOfType<LE01TerrainAuthor>();Require(author!=null&&LE03Modules.HasLayer(author),"new process opens full module scene");var retained=LE03Modules.GetOrCreate(author).Read();Require(TerrainQueries.ContentHash(author.Read())==old.authorHash&&Hash(JsonUtility.ToJson(retained))==old.moduleLayerHash,"scene base and source layer persist");Require(retained.assets.All(a=>old.sources.Any(s=>s.assetId==a.assetId&&s.sourceHash==a.sourceHash)),"scene retains the measured workshop source versions");Require(LE01CEvidence.MeshFingerprint(author)==old.meshHash,"scene actual mixed meshes persist");var world=JsonUtility.FromJson<VoxelWorldFile>(File.ReadAllText(Path.Combine(Root,old.native)));Require(world.terrain!=null&&world.layer!=null&&Hash(JsonUtility.ToJson(world.layer))==old.moduleLayerHash,"native full module world persists");var build=LE03Modules.BuildForEvidence(author);RequireDisplayed(build,"reopened");Require(Hash(JsonUtility.ToJson(new PaletteFile{entries=build.palette}))==old.paletteHash,"reopened source colors persist");ModuleNative("ModuleStructurePlayground_719_reopened");report.authorHash=old.authorHash;report.moduleLayerHash=old.moduleLayerHash;report.paletteHash=old.paletteHash;report.meshHash=old.meshHash;report.native=old.native;report.status="PASS";}
            catch(Exception error){report.checks.Add(new Check{name="uncaught",status="FAIL",detail=error.ToString()});throw;}
            finally{SaveReport("module-reopen-evidence");}Debug.Log("LE03_MODULE_REOPEN_COMPLETE");
        }
        static bool BuiltinGuid(string guid){return guid=="00000000000000000000000000000000"||guid=="0000000000000000f0000000000000000"||guid=="0000000000000000e0000000000000000"||guid=="0000000000000000d0000000000000000";}
        static string LockedPackageVersion(string json,string name)
        {
            var start=System.Text.RegularExpressions.Regex.Match(json,"\""+System.Text.RegularExpressions.Regex.Escape(name)+"\"\\s*:\\s*\\{");if(!start.Success)return null;int open=start.Index+start.Length-1,depth=0;bool quoted=false,escape=false;
            for(int i=open;i<json.Length;i++){char c=json[i];if(quoted){if(escape)escape=false;else if(c=='\\')escape=true;else if(c=='\"')quoted=false;continue;}if(c=='\"'){quoted=true;continue;}if(c=='{')depth++;else if(c=='}'&&--depth==0){var version=System.Text.RegularExpressions.Regex.Match(json.Substring(open+1,i-open-1),"\"version\"\\s*:\\s*\"([^\"]+)\"");return version.Success?version.Groups[1].Value:null;}}return null;
        }
        static string Hierarchy(Transform item){string path=item.name;while(item.parent!=null){item=item.parent;path=item.name+"/"+path;}return path;}
        public static void VerifyDeliveryAssets()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Delivery dependency checks require the isolated background QA project.");Directory.CreateDirectory(Path.Combine(Root,"reports"));var delivery=new DeliveryReport{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash()};
            Action<bool,string,string> check=(ok,name,detail)=>delivery.checks.Add(new Check{name=name,status=ok?"PASS":"FAIL",detail=detail});string project=Path.GetDirectoryName(Application.dataPath);delivery.packageLockPath=Path.Combine(project,"Packages/packages-lock.json");bool locked=File.Exists(delivery.packageLockPath);check(locked,"package lock exists",delivery.packageLockPath);string packageLock=locked?File.ReadAllText(delivery.packageLockPath):"";delivery.packageLockSha256=locked?HashBytes(File.ReadAllBytes(delivery.packageLockPath)):null;var paths=new HashSet<string>();var scenePaths=new List<string>();foreach(string folder in new[]{"Assets/LE03/Scenes","Assets/LE03/WorkScenes"})if(AssetDatabase.IsValidFolder(folder))foreach(string guid in AssetDatabase.FindAssets("t:Scene",new[]{folder}))scenePaths.Add(AssetDatabase.GUIDToAssetPath(guid));
            check(scenePaths.Contains(CoreScenePath)&&scenePaths.Contains(ModuleScenePath),"both research scenes are delivered",string.Join(",",scenePaths));
            foreach(string path in scenePaths.Distinct().OrderBy(p=>p))
            {
                var item=new DeliveryScene{path=path,guid=AssetDatabase.AssetPathToGUID(path),dependencies=AssetDatabase.GetDependencies(path,true)};delivery.scenes.Add(item);paths.Add(path);foreach(string dependency in item.dependencies)paths.Add(dependency);var previous=SceneManager.GetActiveScene();var scene=SceneManager.GetSceneByPath(path);bool opened=!scene.IsValid()||!scene.isLoaded;
                try
                {
                    if(opened)scene=EditorSceneManager.OpenScene(path,OpenSceneMode.Additive);foreach(var root in scene.GetRootGameObjects())foreach(var transform in root.GetComponentsInChildren<Transform>(true))
                    {
                        var go=transform.gameObject;item.objects++;int missing=GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(go);item.missingScripts+=missing;if(missing>0)item.errors.Add("Missing script: "+Hierarchy(transform));
                        foreach(var filter in go.GetComponents<MeshFilter>()){item.meshFilters++;if(filter.sharedMesh==null){item.missingObjects++;item.errors.Add("Missing mesh: "+Hierarchy(transform));}}
                        foreach(var renderer in go.GetComponents<Renderer>())foreach(var material in renderer.sharedMaterials)if(material==null||material.shader==null||material.shader.name=="Hidden/InternalErrorShader"){item.missingObjects++;item.errors.Add("Missing material/shader: "+Hierarchy(transform));}
                        foreach(var component in go.GetComponents<Component>())if(component!=null)
                        {
                            var serialized=new SerializedObject(component);var property=serialized.GetIterator();while(property.NextVisible(true))if(property.propertyType==SerializedPropertyType.ObjectReference&&property.objectReferenceValue==null&&property.objectReferenceInstanceIDValue!=0){item.missingObjects++;item.errors.Add("Missing PPtr: "+Hierarchy(transform)+"/"+property.propertyPath);}
                        }
                    }
                    check(item.meshFilters>0&&item.missingScripts==0&&item.missingObjects==0,"research scene references resolve "+path,string.Join("; ",item.errors));
                }
                catch(Exception error){item.errors.Add(error.ToString());check(false,"research scene inspection "+path,error.Message);}
                finally{if(opened&&scene.IsValid()&&scene.isLoaded)EditorSceneManager.CloseScene(scene,true);if(previous.IsValid()&&previous.isLoaded)SceneManager.SetActiveScene(previous);}
            }
            const string kitRoot="Assets/LE03/ModuleKit";check(AssetDatabase.IsValidFolder(kitRoot),"ModuleKit folder exists",kitRoot);if(AssetDatabase.IsValidFolder(kitRoot))foreach(string guid in AssetDatabase.FindAssets("",new[]{kitRoot})){string path=AssetDatabase.GUIDToAssetPath(guid);if(!AssetDatabase.IsValidFolder(path))paths.Add(path);}
            var guids=new Dictionary<string,string>();int certifiedSources=0;foreach(string path in paths.OrderBy(p=>p))
            {
                if(string.IsNullOrEmpty(path)||path.StartsWith("Resources/",StringComparison.Ordinal)||path.StartsWith("Library/",StringComparison.Ordinal))continue;
                var asset=new DeliveryAsset{path=path,guid=AssetDatabase.AssetPathToGUID(path),kind=Path.GetExtension(path).ToLowerInvariant(),exists=File.Exists(path),mainObject=AssetDatabase.LoadMainAssetAtPath(path)!=null};delivery.assets.Add(asset);bool resolvable=!string.IsNullOrEmpty(asset.guid)&&AssetDatabase.GUIDToAssetPath(asset.guid)==path;check(resolvable,"GUID resolves "+path,asset.guid);string first;if(!string.IsNullOrEmpty(asset.guid)){if(guids.TryGetValue(asset.guid,out first))check(first==path,"unique GUID "+path,first);else guids[asset.guid]=path;}
                if(path.StartsWith("Assets/",StringComparison.Ordinal)){check(asset.exists,"asset file exists "+path,path);string meta=path+".meta";check(File.Exists(meta),"asset meta exists "+path,meta);if(asset.exists)asset.sourceSha256=HashBytes(File.ReadAllBytes(path));if(File.Exists(meta))asset.metaSha256=HashBytes(File.ReadAllBytes(meta));}
                if(path.StartsWith("Packages/",StringComparison.Ordinal))
                {
                    check(asset.mainObject,"package dependency imports "+path,path);var package=UnityEditor.PackageManager.PackageInfo.FindForAssetPath(path);bool known=package!=null&&!string.IsNullOrEmpty(package.name)&&!string.IsNullOrEmpty(package.resolvedPath);check(known,"package provenance resolves "+path,path);
                    if(known){asset.packageName=package.name;asset.resolvedPackageVersion=package.version;asset.packageVersion=LockedPackageVersion(packageLock,package.name);check(!string.IsNullOrEmpty(asset.packageVersion),"package version is locked "+path,asset.packageVersion??"missing lock entry");string prefix="Packages/"+package.name+"/";bool matches=path.StartsWith(prefix,StringComparison.Ordinal);check(matches,"package path matches identity "+path,prefix);if(matches){string resolvedRoot=Path.GetFullPath(package.resolvedPath).TrimEnd(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar)+Path.DirectorySeparatorChar;string source=Path.GetFullPath(Path.Combine(resolvedRoot,path.Substring(prefix.Length).Replace('/',Path.DirectorySeparatorChar)));bool inRoot=source.StartsWith(resolvedRoot,StringComparison.OrdinalIgnoreCase);check(inRoot&&File.Exists(source)&&File.Exists(source+".meta"),"resolved package source and meta exist "+path,source);if(inRoot&&File.Exists(source))asset.sourceSha256=HashBytes(File.ReadAllBytes(source));if(inRoot&&File.Exists(source+".meta"))asset.metaSha256=HashBytes(File.ReadAllBytes(source+".meta"));}}
                }
                if(asset.exists&&(asset.kind==".unity"||asset.kind==".mat"||asset.kind==".prefab"||asset.kind==".asset")&&new FileInfo(path).Length<=8388608)
                {
                    foreach(System.Text.RegularExpressions.Match match in System.Text.RegularExpressions.Regex.Matches(File.ReadAllText(path),@"guid:\s*([0-9a-fA-F]{32})")){string guid=match.Groups[1].Value;if(!BuiltinGuid(guid)&&string.IsNullOrEmpty(AssetDatabase.GUIDToAssetPath(guid)))asset.unresolved.Add(guid);}check(asset.unresolved.Count==0,"serialized GUID references resolve "+path,string.Join(",",asset.unresolved));
                }
                if(path.StartsWith(kitRoot+"/",StringComparison.Ordinal)&&path.EndsWith(".voxel.json",StringComparison.OrdinalIgnoreCase)&&Path.GetFileName(path)!="kit6.voxel.json"){string error;bool valid=VoxelModules.ValidateAsset(JsonUtility.FromJson<VoxelModuleAsset>(File.ReadAllText(path)),out error);check(valid,"delivered complete source certifies "+path,error??"");if(valid)certifiedSources++;}
            }
            check(certifiedSources>=6,"all six complete module sources are delivered",certifiedSources.ToString());delivery.status=delivery.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";File.WriteAllText(Path.Combine(Root,"reports/scene-assets.json"),JsonUtility.ToJson(delivery,true));if(delivery.status!="PASS")throw new InvalidOperationException("Research scene/ModuleKit dependency validation failed; inspect scene-assets.json");Debug.Log("LE03_DELIVERY_ASSETS_COMPLETE");
        }
    }
}
