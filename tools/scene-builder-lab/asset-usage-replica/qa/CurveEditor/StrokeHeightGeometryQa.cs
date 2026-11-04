using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Drives the real Window API and audits its actual source meshes/colliders.
    // No substitute height algorithm and no claim about physical Shift/mouse input.
    public static class StrokeHeightGeometryQa
    {
        const string ScenePath="Assets/BridgeReplica/Scenes/StrokeHeightGeometry.unity";
        [Serializable] sealed class Check
        {
            public string name,status="PASS",error="",lastStatus,beforeMesh,previewMesh,afterMesh;
            public float targetWorldY,extraFlatLength,endpointError,largestObservedRise;
            public bool heightAccepted,committed,authorityHeldUntilEnd,oldNodesPreserved,sameAuthorAndKit,undoRestored,redoRestored;
            public bool nativePersistentBeforeRebuild,nativeGeometryBeforeRebuild,rebuildRestored;
            public bool rebuildDocumentExact,rebuildMappingExact,rebuildMeshExact,rebuildKitExact;
            public bool rawMapExact,semanticMapExact,sourceAssetIdentitiesExact,rawMappingChangedOnlyTransientObjectIds;
            public string rebuiltMesh,rebuiltKitPath,beforeMappingDiagnostic,afterMappingDiagnostic;
            public string expectedSourceAssetSignature,beforeSourceAssetSignature,afterSourceAssetSignature;
            public List<MeshDifference> rebuildMeshDifferences=new List<MeshDifference>();
            public int walkingRays,walkingMisses,nonQuarterTops,badWalkingNormals,largeRises,wrongSurfaceHeights,topTriangles,flippedTopTriangles,badTopVertexNormals;
            public float firstSurfaceY,lastSurfaceY,minimumSurfaceY=100,maximumSurfaceY=-100;
            public List<float> observedStepTops=new List<float>();
            public List<string> diagnostics=new List<string>();
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,sourceHash;
            public string scope="Real Window SetDrawHeight absolute world target, actual committed tread/deck source mesh and collider height, three walking bands, native Undo/Redo and saved single scene. Background API only; no physical Shift/mouse claim.";
            public bool physicalInput=false;
            public List<Check> checks=new List<Check>();
        }
        // Same fields as the existing independent saved-author reopen contract.
        [Serializable] sealed class Expected
        {public string scene,authorName,document,mapping,mesh,kitPath,sourceHash;public Vector3 first,last;public SourceAssetIdentity[] sourceAssetIdentities;}
        [Serializable] sealed class ObjectAssetIdentity
        {public bool present;public string assetPath,guid,name;public long localFileId;}
        [Serializable] sealed class SourceAssetIdentity
        {
            public string role,id,modelPath,palettePath,modelSha256,paletteSha256,nativeSha256;
            public ObjectAssetIdentity material,mesh;
        }
        [Serializable] sealed class SourceAssetIdentityList {public SourceAssetIdentity[] items;}
        [Serializable] sealed class MeshDifference
        {
            public string role,channel,beforeValue,afterValue,beforeBits,afterBits;
            public int beforeLength,afterLength,index=-1,component=-1,differingComponents;
            public float largestAbsoluteDelta;
        }
        sealed class MeshState
        {public string role;public Vector3[] vertices,normals;public Vector2[] uv;public Color[] colors;public int[] triangles;}
        static string Root{get{return Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");}}
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void Fixture(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static Vector3 World(ReplicaAuthor a,RouteNode n){return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(ReplicaSession.Get(a).Geometry);}
        static ObjectAssetIdentity ObjectIdentity(UnityEngine.Object value)
        {
            if(value==null)return new ObjectAssetIdentity{present=false,assetPath="",guid="",name=""};
            string guid="";long localId=0;string path=AssetDatabase.GetAssetPath(value);
            Fixture(!string.IsNullOrEmpty(path)&&AssetDatabase.TryGetGUIDAndLocalFileIdentifier(value,out guid,out localId),"source Material/Mesh is not a persistent identifiable asset: "+value.name);
            return new ObjectAssetIdentity{present=true,assetPath=path,guid=guid,name=value.name,localFileId=localId};
        }
        static SourceAssetIdentity[] SourceIdentities(ReplicaKit kit)
        {
            Fixture(kit!=null&&kit.Bindings!=null,"source kit/bindings absent");
            return kit.Bindings.OrderBy(b=>b.Role,StringComparer.Ordinal).Select(b=>new SourceAssetIdentity{
                role=b.Role,id=b.Id,modelPath=b.ModelPath,palettePath=b.PalettePath,modelSha256=b.ModelSha256,paletteSha256=b.PaletteSha256,nativeSha256=b.NativeSha256,
                material=ObjectIdentity(b.Material),mesh=ObjectIdentity(b.Mesh)
            }).ToArray();
        }
        static string IdentityJson(SourceAssetIdentity[] identities){return JsonUtility.ToJson(new SourceAssetIdentityList{items=identities});}
        static string IdentitySignature(SourceAssetIdentity[] identities){return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(IdentityJson(identities)));}
        static string StableMapping(string json)
        {
            // Only Unity's temporary pointers in these two object-reference
            // fields are normalized. Source IDs, hashes, placement ranges and
            // every other mapping byte remain part of the exact comparison.
            return Regex.Replace(json,"(\"(?:Material|Mesh)\"\\s*:\\s*\\{\\s*\"instanceID\"\\s*:\\s*)-?\\d+(\\s*\\})",match=>match.Groups[1].Value+"0"+match.Groups[2].Value);
        }
        static Dictionary<string,MeshState> CaptureMeshes(GameObject geometry)
        {
            var result=new Dictionary<string,MeshState>(StringComparer.Ordinal);
            foreach(var f in geometry.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.sharedMesh!=null))
            {
                var m=f.sharedMesh;result.Add(f.name,new MeshState{role=f.name,vertices=m.vertices,normals=m.normals,uv=m.uv,colors=m.colors,triangles=m.triangles});
            }
            return result;
        }
        static int Bits(float value){return BitConverter.ToInt32(BitConverter.GetBytes(value),0);}
        static void FloatDifference(List<MeshDifference> differences,string role,string channel,float[] before,float[] after,int components)
        {
            var d=new MeshDifference{role=role,channel=channel,beforeLength=before.Length/components,afterLength=after.Length/components};
            for(int i=0;i<Math.Min(before.Length,after.Length);i++)
            {
                if(Bits(before[i])==Bits(after[i]))continue;
                d.differingComponents++;d.largestAbsoluteDelta=Mathf.Max(d.largestAbsoluteDelta,Mathf.Abs(before[i]-after[i]));
                if(d.index<0){d.index=i/components;d.component=i%components;d.beforeValue=before[i].ToString("R",System.Globalization.CultureInfo.InvariantCulture);d.afterValue=after[i].ToString("R",System.Globalization.CultureInfo.InvariantCulture);d.beforeBits=Bits(before[i]).ToString("X8");d.afterBits=Bits(after[i]).ToString("X8");}
            }
            if(before.Length!=after.Length||d.differingComponents>0)differences.Add(d);
        }
        static List<MeshDifference> CompareMeshes(Dictionary<string,MeshState> before,Dictionary<string,MeshState> after)
        {
            var result=new List<MeshDifference>();
            foreach(string role in before.Keys.Union(after.Keys).OrderBy(n=>n,StringComparer.Ordinal))
            {
                MeshState a,b;
                if(!before.TryGetValue(role,out a)||!after.TryGetValue(role,out b)){result.Add(new MeshDifference{role=role,channel="mesh-presence",beforeValue=before.ContainsKey(role)?"present":"absent",afterValue=after.ContainsKey(role)?"present":"absent"});continue;}
                FloatDifference(result,role,"vertex-X/Y/Z",a.vertices.SelectMany(p=>new[]{p.x,p.y,p.z}).ToArray(),b.vertices.SelectMany(p=>new[]{p.x,p.y,p.z}).ToArray(),3);
                FloatDifference(result,role,"UV-X/Y",a.uv.SelectMany(p=>new[]{p.x,p.y}).ToArray(),b.uv.SelectMany(p=>new[]{p.x,p.y}).ToArray(),2);
                FloatDifference(result,role,"normal-X/Y/Z",a.normals.SelectMany(p=>new[]{p.x,p.y,p.z}).ToArray(),b.normals.SelectMany(p=>new[]{p.x,p.y,p.z}).ToArray(),3);
                FloatDifference(result,role,"color-R/G/B/A",a.colors.SelectMany(p=>new[]{p.r,p.g,p.b,p.a}).ToArray(),b.colors.SelectMany(p=>new[]{p.r,p.g,p.b,p.a}).ToArray(),4);
                var d=new MeshDifference{role=role,channel="triangle-index",beforeLength=a.triangles.Length,afterLength=b.triangles.Length};
                for(int i=0;i<Math.Min(a.triangles.Length,b.triangles.Length);i++)if(a.triangles[i]!=b.triangles[i])
                {d.differingComponents++;if(d.index<0){d.index=i;d.beforeValue=a.triangles[i].ToString();d.afterValue=b.triangles[i].ToString();}}
                if(a.triangles.Length!=b.triangles.Length||d.differingComponents>0)result.Add(d);
            }
            return result;
        }
        static void TextDifference(Check check,string label,string before,string after)
        {
            if(before==after)return;int index=0;while(index<Math.Min(before.Length,after.Length)&&before[index]==after[index])index++;
            int start=Math.Max(0,index-100);
            check.diagnostics.Add(label+" first different character="+index+", lengths="+before.Length+"/"+after.Length+"; before="+before.Substring(start,Math.Min(240,before.Length-start))+"; after="+after.Substring(start,Math.Min(240,after.Length-start)));
        }
        static string SourceHash()
        {
            string dir=Path.Combine(Application.dataPath,"BridgeReplica");
            var files=Directory.GetFiles(dir,"*.cs",SearchOption.AllDirectories).Where(f=>!f.Replace('\\','/').Contains("/Editor/QA/")).OrderBy(f=>f,StringComparer.Ordinal);
            return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(string.Join("\n",files.Select(f=>"Assets/"+Path.GetFullPath(f).Substring(Path.GetFullPath(Application.dataPath).Length+1).Replace('\\','/')+"|"+ReplicaKitRegistry.HashFile(f)).ToArray())));
        }
        static bool SetHeight(ReplicaWindow window,float worldY)
        {
            var method=typeof(ReplicaWindow).GetMethod("SetDrawHeight",BindingFlags.Instance|BindingFlags.Public,null,new[]{typeof(float)},null);
            Need(method!=null&&method.ReturnType==typeof(bool),"public bool SetDrawHeight(float absoluteWorldY) is missing");
            try{return (bool)method.Invoke(window,new object[]{worldY});}catch(TargetInvocationException e){throw e.InnerException??e;}
        }
        static bool WalkingHit(ReplicaAuthor author,Collider[] colliders,CurveResult curve,float arc,float side,out RaycastHit nearest)
        {
            var f=curve.FrameAt(arc);var origin=author.transform.TransformPoint(new Vector3(f.X+(f.LeftX-f.RightX)*side,14,f.Z+(f.LeftZ-f.RightZ)*side));
            var ray=new Ray(origin,-author.transform.up);nearest=new RaycastHit();float distance=float.PositiveInfinity;bool found=false;
            foreach(var collider in colliders)
            {RaycastHit hit;if(collider.Raycast(ray,out hit,30)&&hit.distance<distance){found=true;distance=hit.distance;nearest=hit;}}
            return found;
        }
        static void Audit(ReplicaAuthor author,Check check)
        {
            var result=ReplicaRoute.Solve(author.Read());Fixture(result.Valid&&result.Curve!=null,"committed author does not solve: "+result.Message);var curve=result.Curve;
            var geometry=ReplicaSession.Get(author).Geometry;Fixture(geometry!=null,"committed geometry missing");
            var filters=geometry.GetComponentsInChildren<MeshFilter>(true).Where(f=>f.name=="tread"||f.name=="deck").ToArray();Fixture(filters.Length>0,"walking source meshes absent");
            foreach(var f in filters)Fixture(f.sharedMesh!=null&&f.GetComponent<MeshCollider>()!=null&&f.GetComponent<MeshCollider>().sharedMesh==f.sharedMesh,"actual visible/collision meshes differ");
            var map=JsonUtility.FromJson<CurveMapping>(author.MappingJson);Fixture(map!=null&&map.placements!=null,"actual source mapping absent");
            // Read each real placement's top, including every separate tread.
            // A global maximum would inspect only the highest step and miss
            // inverted lower treads or a descending stair's entire surface.
            foreach(var p in map.placements.Where(p=>p.role=="deck"||p.role=="tread"))
            {
                var filter=filters.Single(f=>f.name==p.role);var mesh=filter.sharedMesh;var v=mesh.vertices;var t=mesh.triangles;var normals=mesh.normals;
                Fixture(p.firstVertex>=0&&p.vertexCount>0&&p.firstVertex+p.vertexCount<=v.Length&&p.firstTriangle>=0&&(p.firstTriangle+p.triangleCount)*3<=t.Length,"source placement ranges exceed actual mesh");
                float top=float.NegativeInfinity;for(int n=p.firstVertex;n<p.firstVertex+p.vertexCount;n++)top=Mathf.Max(top,v[n].y);
                for(int n=p.firstTriangle*3;n<(p.firstTriangle+p.triangleCount)*3;n+=3)
                {
                    int ia=t[n],ib=t[n+1],ic=t[n+2];var a=v[ia];var b=v[ib];var c=v[ic];
                    if(Mathf.Abs(a.y-top)>.0001f||Mathf.Abs(b.y-top)>.0001f||Mathf.Abs(c.y-top)>.0001f)continue;
                    check.topTriangles++;var up=Vector3.Cross(filter.transform.TransformPoint(b)-filter.transform.TransformPoint(a),filter.transform.TransformPoint(c)-filter.transform.TransformPoint(a));
                    if(Vector3.Dot(up,author.transform.up)<=.0000001f)check.flippedTopTriangles++;
                    foreach(int index in new[]{ia,ib,ic})if(normals.Length!=v.Length||Vector3.Dot(filter.transform.TransformDirection(normals[index]),author.transform.up)<.99f)check.badTopVertexNormals++;
                }
            }
            Physics.SyncTransforms();var colliders=filters.Select(f=>(Collider)f.GetComponent<MeshCollider>()).ToArray();
            var stations=new SortedSet<float>{.01f,curve.Length-.01f};for(float s=.025f;s<curve.Length-.01f;s+=.125f)stations.Add(s);
            foreach(float seam in new[]{8f,14f})foreach(float delta in new[]{-.05f,-.01f,.01f,.05f})if(seam+delta>.005f&&seam+delta<curve.Length-.005f)stations.Add(seam+delta);
            foreach(float side in new[]{-.4f,0,.4f})
            {
                bool previous=false;float previousY=0;
                foreach(float arc in stations)
                {
                    check.walkingRays++;RaycastHit hit;
                    if(!WalkingHit(author,colliders,curve,arc,side,out hit)){check.walkingMisses++;if(check.diagnostics.Count<12)check.diagnostics.Add("walking miss arc="+arc+", side="+side);previous=false;continue;}
                    float y=author.transform.InverseTransformPoint(hit.point).y;
                    check.minimumSurfaceY=Mathf.Min(check.minimumSurfaceY,hit.point.y);check.maximumSurfaceY=Mathf.Max(check.maximumSurfaceY,hit.point.y);
                    if(!check.observedStepTops.Any(value=>Mathf.Abs(value-y)<.0001f))check.observedStepTops.Add(y);
                    if(Mathf.Abs(y/.25f-Mathf.Round(y/.25f))>.001f)check.nonQuarterTops++;
                    if(Vector3.Dot(hit.normal,author.transform.up)<.99f)check.badWalkingNormals++;
                    float expected=curve.FrameAt(arc).Y;
                    // A terminal descending tread can stand one .25m riser
                    // above the endpoint/ground; it must not be mistaken for a
                    // flat bridge merely carrying a changed author endpoint.
                    if(Mathf.Abs(y-expected)>.251f)check.wrongSurfaceHeights++;
                    if(check.extraFlatLength>0&&arc>14.05f&&Mathf.Abs(hit.point.y-check.targetWorldY)>.001f)check.wrongSurfaceHeights++;
                    if(previous){float rise=Mathf.Abs(y-previousY);check.largestObservedRise=Mathf.Max(check.largestObservedRise,rise);if(rise>.251f)check.largeRises++;}
                    previous=true;previousY=y;
                    if(side==0&&Mathf.Abs(arc-.01f)<.0001f)check.firstSurfaceY=hit.point.y;
                    if(side==0&&Mathf.Abs(arc-(curve.Length-.01f))<.0001f)check.lastSurfaceY=hit.point.y;
                }
            }
            check.observedStepTops.Sort();
            Need(check.walkingMisses==0,"actual walking surface has holes: "+check.walkingMisses+"/"+check.walkingRays);
            Need(check.nonQuarterTops==0&&check.largeRises==0,"actual step tops/rises violate .25m increments; largest rise="+check.largestObservedRise);
            Need(check.wrongSurfaceHeights==0,"actual mesh/collider does not follow the accepted height profile");
            Need(check.topTriangles>0&&check.flippedTopTriangles==0&&check.badTopVertexNormals==0&&check.badWalkingNormals==0,"actual walking mesh normals/winding are not upward");
            Need(Mathf.Abs(check.firstSurfaceY-2)<.001f&&Mathf.Abs(check.lastSurfaceY-check.targetWorldY)<=.251f,"actual start/end walking heights do not reach the fixture/target");
        }
        static Check Gesture(float target,float extra,bool save,string sourceHash)
        {
            var check=new Check{name="world-height-"+target+(extra>0?"-then-flat-"+extra:""),targetWorldY=target,extraFlatLength=extra};ReplicaWindow window=null;bool saved=false;
            try
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                window=ScriptableObject.CreateInstance<ReplicaWindow>();var sceneGui=typeof(ReplicaWindow).GetMethod("SceneGUI",BindingFlags.Instance|BindingFlags.NonPublic);
                SceneView.duringSceneGui-=(Action<SceneView>)Delegate.CreateDelegate(typeof(Action<SceneView>),window,sceneGui);
                var doc=new RouteDocument{SchemaVersion=2,Id="stroke-height-"+target+"-"+extra,Width=2,KitId="workshop.bridge.A",KitVersion="1"};
                doc.Nodes.Add(new RouteNode{Id="old-first",X=0,Y=2});doc.Nodes.Add(new RouteNode{Id="old-last",X=8,Y=2});
                var author=new GameObject("Stroke_height_editable_bridge").AddComponent<ReplicaAuthor>();var kit=ReplicaKitRegistry.EnsureBase();var session=ReplicaSession.Get(author);
                Fixture(session.Preview(doc,kit)&&session.ApplyNew(),"flat original bridge failed: "+session.Status);window.Select(author);window.SetDrawMode(true);Undo.ClearAll();
                string before=author.DocumentJson,beforeMap=author.MappingJson;check.beforeMesh=Mesh(author);var press=World(author,author.Read().Nodes.Last());
                window.BeginDraw(press);Need(window.Drawing,"tail did not start actual Window gesture");for(int i=1;i<=12;i++)Need(window.DragDraw(press+Vector3.right*(i*.5f)),"ordinary 6m extension rejected: "+window.Status);
                check.heightAccepted=SetHeight(window,target);Need(check.heightAccepted,"absolute world height target rejected: "+window.Status);
                var preview=author.transform.Find("__RoutePreview");Fixture(preview!=null&&session.HasCandidate,"height setter did not produce actual preview geometry");check.previewMesh=ReplicaGeometry.Fingerprint(preview.gameObject);
                Need(check.previewMesh!=check.beforeMesh,"height edit did not change actual preview mesh");
                for(int i=1;i<=Mathf.RoundToInt(extra/.5f);i++)Need(window.DragDraw(press+Vector3.right*(6+i*.5f)),"flat continuation after completed height key rejected: "+window.Status);
                var candidate=session.Candidate;Fixture(candidate!=null&&candidate.Curve!=null,"height candidate missing");
                Need(Mathf.Abs(candidate.Curve.FrameAt(14).Y-target)<.0001f,"completed 6m ramp was stretched or lost during later planar drawing");
                check.authorityHeldUntilEnd=author.DocumentJson==before&&author.MappingJson==beforeMap;Need(check.authorityHeldUntilEnd,"preview changed committed author data before EndDraw");
                check.committed=window.EndDraw();check.lastStatus=window.Status;Need(check.committed,"height gesture did not commit: "+check.lastStatus);
                var afterDoc=author.Read();check.endpointError=Vector3.Distance(World(author,afterDoc.Nodes.Last()),new Vector3(14+extra,target,0));
                check.sameAuthorAndKit=window.Author==author&&Authors().Length==1&&author.Kit==kit;
                check.oldNodesPreserved=doc.Nodes.All(old=>afterDoc.Nodes.Any(n=>JsonUtility.ToJson(n)==JsonUtility.ToJson(old)));
                Need(check.endpointError<.001f&&check.sameAuthorAndKit&&check.oldNodesPreserved,"committed endpoint, author, old nodes or kit changed incorrectly");
                check.afterMesh=Mesh(author);Need(check.afterMesh!=check.beforeMesh,"actual committed mesh stayed flat");Audit(author,check);
                string after=author.DocumentJson,afterMap=author.MappingJson;Undo.FlushUndoRecordObjects();Undo.PerformUndo();check.undoRestored=author.DocumentJson==before&&author.MappingJson==beforeMap&&Mesh(author)==check.beforeMesh&&author.Kit==kit;
                Undo.PerformRedo();check.redoRestored=author.DocumentJson==after&&author.MappingJson==afterMap&&Mesh(author)==check.afterMesh&&author.Kit==kit;
                Need(check.undoRestored&&check.redoRestored,"one native Undo/Redo did not restore actual geometry, author and kit");
                if(save)
                {
                    ReplicaFiles.SaveScene(ScenePath);Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"native scene contains transient generated meshes");
                    var expected=new Expected{scene=ScenePath,authorName=author.name,document=author.DocumentJson,mapping=author.MappingJson,mesh=Mesh(author),kitPath=AssetDatabase.GetAssetPath(author.Kit),sourceHash=sourceHash,first=World(author,author.Read().Nodes.First()),last=World(author,author.Read().Nodes.Last()),sourceAssetIdentities=SourceIdentities(author.Kit)};
                    Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,"reports/stroke-height-expected.json"),JsonUtility.ToJson(expected,true));saved=true;
                }
            }
            catch(Exception e){var root=e.GetBaseException();check.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";check.error=root.ToString();}
            finally
            {
                if(window!=null){window.CancelInput();UnityEngine.Object.DestroyImmediate(window);}
                if(!saved)foreach(var author in Authors())if(author!=null)ReplicaGeometry.Destroy(author.gameObject);
            }
            return check;
        }
        public static void Red(){Run("stroke-height-geometry-red");}
        public static void Green(){Run("stroke-height-geometry-green");}
        public static void Reopen()
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use an independent existing background QA process only.");
            var report=new Report{sourceHash=SourceHash(),scope="Independent native saved height-profile reopen before regeneration: exact persisted raw Mapping/Document/Mesh first; after rebuild compare all mapping bytes except temporary Material/Mesh.instanceID, independently require all binding role/ID/hash and asset GUID/path/name/local-ID identities. Exact source geometry, kit and same-process Undo/Redo; no physical input claim."};
            var check=new Check{name="independent-native-height-reopen-rebuild-and-node-edit"};report.checks.Add(check);
            try
            {
                var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Root,"reports/stroke-height-expected.json")));
                Need(expected!=null&&expected.sourceHash==report.sourceHash,"production source differs between height save and independent reopen");
                Need(expected.sourceAssetIdentities!=null&&expected.sourceAssetIdentities.Length>0,"saved stable source-asset identities absent; rerun Geometry.Green before independent reopen");
                EditorSceneManager.OpenScene(expected.scene,OpenSceneMode.Single);Selection.activeGameObject=null;Undo.ClearAll();
                var authors=Authors();Need(authors.Length==1,"native height scene reopened with missing/multiple authors");var author=authors[0];
                check.targetWorldY=expected.last.y;check.extraFlatLength=3;check.beforeMesh=expected.mesh;
                // These checks precede any ReplicaSession.Rebuild. Finding the
                // geometry or fingerprinting its arrays does not regenerate it.
                Need(author.name==expected.authorName&&author.DocumentJson==expected.document&&author.MappingJson==expected.mapping,"native author height profile/mapping changed before regeneration");
                var nativeFilters=author.GetComponentsInChildren<MeshFilter>();
                check.nativePersistentBeforeRebuild=nativeFilters.Length>0&&nativeFilters.All(f=>f.sharedMesh!=null&&AssetDatabase.Contains(f.sharedMesh));
                Need(check.nativePersistentBeforeRebuild,"native reopen depends on transient/missing generated meshes");
                Need(AssetDatabase.GetAssetPath(author.Kit)==expected.kitPath,"native height kit changed");
                var nativeSourceIdentities=SourceIdentities(author.Kit);check.expectedSourceAssetSignature=IdentitySignature(expected.sourceAssetIdentities);check.beforeSourceAssetSignature=IdentitySignature(nativeSourceIdentities);
                Need(IdentityJson(nativeSourceIdentities)==IdentityJson(expected.sourceAssetIdentities),"native source binding role/ID/hash or Material/Mesh asset identity changed before regeneration");
                check.nativeGeometryBeforeRebuild=Mesh(author)==expected.mesh;
                Need(check.nativeGeometryBeforeRebuild,"persistent source mesh arrays changed before regeneration");
                Need(Vector3.Distance(World(author,author.Read().Nodes.First()),expected.first)<.0001f&&Vector3.Distance(World(author,author.Read().Nodes.Last()),expected.last)<.0001f,"native height endpoints changed");
                Audit(author,check);
                var nativeMeshArrays=CaptureMeshes(ReplicaSession.Get(author).Geometry);
                var session=ReplicaSession.Get(author);Need(session.Rebuild(),"native height author cannot rebuild: "+session.Status);
                check.rebuildDocumentExact=author.DocumentJson==expected.document;
                check.rebuildMappingExact=author.MappingJson==expected.mapping;
                check.rawMapExact=check.rebuildMappingExact;
                check.semanticMapExact=StableMapping(author.MappingJson)==StableMapping(expected.mapping);
                check.rawMappingChangedOnlyTransientObjectIds=!check.rawMapExact&&check.semanticMapExact;
                var rebuiltSourceIdentities=SourceIdentities(author.Kit);check.afterSourceAssetSignature=IdentitySignature(rebuiltSourceIdentities);
                check.sourceAssetIdentitiesExact=IdentityJson(expected.sourceAssetIdentities)==IdentityJson(nativeSourceIdentities)&&IdentityJson(nativeSourceIdentities)==IdentityJson(rebuiltSourceIdentities);
                check.rebuiltMesh=Mesh(author);check.rebuildMeshExact=check.rebuiltMesh==expected.mesh;
                check.rebuiltKitPath=AssetDatabase.GetAssetPath(author.Kit);check.rebuildKitExact=check.rebuiltKitPath==expected.kitPath;
                check.rebuildMeshDifferences=CompareMeshes(nativeMeshArrays,CaptureMeshes(session.Geometry));
                TextDifference(check,"document",expected.document,author.DocumentJson);TextDifference(check,"raw mapping",expected.mapping,author.MappingJson);
                TextDifference(check,"mapping excluding temporary Material/Mesh instanceID",StableMapping(expected.mapping),StableMapping(author.MappingJson));
                TextDifference(check,"stable source asset identity",IdentityJson(expected.sourceAssetIdentities),IdentityJson(rebuiltSourceIdentities));
                if(!check.rebuildMappingExact)
                {
                    check.beforeMappingDiagnostic="reports/stroke-height-rebuild-before.mapping.json";check.afterMappingDiagnostic="reports/stroke-height-rebuild-after.mapping.json";
                    Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,check.beforeMappingDiagnostic),expected.mapping);File.WriteAllText(Path.Combine(Root,check.afterMappingDiagnostic),author.MappingJson);
                }
                if(!check.rebuildDocumentExact)
                {File.WriteAllText(Path.Combine(Root,"reports/stroke-height-rebuild-before.document.json"),expected.document);File.WriteAllText(Path.Combine(Root,"reports/stroke-height-rebuild-after.document.json"),author.DocumentJson);}
                check.rebuildRestored=check.rebuildDocumentExact&&check.semanticMapExact&&check.sourceAssetIdentitiesExact&&check.rebuildMeshExact&&check.rebuildKitExact;
                Need(check.rebuildRestored,"rebuild changed saved height profile, actual geometry, mapping or kit");Audit(author,check);
                Undo.ClearAll();string before=author.DocumentJson,beforeMap=author.MappingJson,beforeMesh=Mesh(author);var kit=author.Kit;
                var edit=author.Read();edit.Nodes[edit.Nodes.Count-1].Y+=.25f;
                Need(session.Preview(edit,kit)&&session.Apply(),"quarter-metre terminal node height edit failed: "+session.Status);
                string after=author.DocumentJson,afterMap=author.MappingJson,afterMesh=Mesh(author);
                Need(after!=before&&afterMesh!=beforeMesh&&Mathf.Abs(World(author,author.Read().Nodes.Last()).y-(expected.last.y+.25f))<.0001f,"height node edit changed data without changing actual geometry/height");
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();check.undoRestored=author.DocumentJson==before&&author.MappingJson==beforeMap&&Mesh(author)==beforeMesh&&author.Kit==kit;
                Undo.PerformRedo();check.redoRestored=author.DocumentJson==after&&author.MappingJson==afterMap&&Mesh(author)==afterMesh&&author.Kit==kit;
                Need(check.undoRestored&&check.redoRestored,"single native Undo/Redo did not restore height profile, geometry and kit after node edit");
                check.targetWorldY=expected.last.y+.25f;check.extraFlatLength=0;check.afterMesh=afterMesh;Audit(author,check);
                // Leave the on-disk expected scene unchanged. This final edit
                // intentionally exists only in the isolated reopen process.
            }
            catch(Exception e){var root=e.GetBaseException();check.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";check.error=root.ToString();}
            report.status=check.status;Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,"reports/stroke-height-reopen.json"),JsonUtility.ToJson(report,true));
            Debug.Log("STROKE_HEIGHT_REOPEN "+check.status+" "+check.error);EditorApplication.Exit(report.status=="PASS"?0:1);
        }
        static void Run(string name)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the existing isolated background QA project only.");
            var report=new Report{sourceHash=SourceHash()};report.checks.Add(Gesture(4,0,false,report.sourceHash));report.checks.Add(Gesture(0,0,false,report.sourceHash));report.checks.Add(Gesture(4,3,true,report.sourceHash));
            report.status=report.checks.Any(c=>c.status=="ERROR")?"ERROR":report.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,"reports",name+".json"),JsonUtility.ToJson(report,true));
            foreach(var check in report.checks)Debug.Log("STROKE_HEIGHT_GEOMETRY "+check.name+" "+check.status+" "+check.error);
            EditorApplication.Exit(report.status=="PASS"?0:1);
        }
    }
}
