using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;
using XingHai.SB03;
using XingHai.SB03.Editor;
using Object = UnityEngine.Object;

namespace XingHai.SB03.QA
{
    // Verification only: independently reads real imported FBX vertices, then
    // compares the public production adapter's display mesh and source map.
    public static class SB03KitTests
    {
        [Serializable] sealed class Contract
        {
            public int schemaVersion;
            public float sourceVoxelMeters,unityAdapterYaw;
            public string kitId,version;
            public Entry[] assets;
        }
        [Serializable] sealed class Entry
        {
            public int number;
            public string id,role,fbx,palette,source,sourceSha256,fbxSha256,paletteSha256;
            public float[] logicalSizeMeters;
            public float unityAdapterYaw;
        }
        [Serializable] sealed class SourceResult
        {
            public string id,status="PASS",nativeSha256,fbxSha256,paletteSha256;
            public int number,sourceMeshCount,sourceVertices,sourceTriangles,placements,displayVertices,displayTriangles,paletteWidth,paletteHeight;
            public float[] actualBounds;
            public float minimumWindingDot;
            public double signedVolume;
            public bool sourceEnvelopeCorrect,unitInstanceScale,completeUV,actualVertexAndUVConsumption,sourceMapCorrect,sourceFilesUnchanged;
        }
        [Serializable] sealed class Report
        {
            public string status="RUNNING",engine=Application.unityVersion,error;
            public string scope="Actual Engine FBX import, original source bytes, adapted mesh arrays and production BridgeGeometry.Build; no desktop input or general asset support claim.";
            public string kitId,kitVersion;
            public bool treadHeelPositiveX,treadNoseNegativeX,allNineSourcesUsed;
            public List<SourceResult> sources=new List<SourceResult>();
        }
        static string OutputRoot {get{return Environment.GetEnvironmentVariable("SB03_REPORT_ROOT")??Path.GetFullPath("SB03-reports");}}
        static string DeliveryRoot
        {
            get
            {
                var output=Environment.GetEnvironmentVariable("SB03_OUTPUT_ROOT");
                if(!string.IsNullOrEmpty(output))return output;
                return Path.GetFullPath(Path.Combine(OutputRoot,".."));
            }
        }
        static void Need(bool value,string text){if(!value)throw new InvalidOperationException(text);}
        static string Sha(string path)
        {using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(File.ReadAllBytes(path))).Replace("-","");}
        static bool Near(float a,float b){return Mathf.Abs(a-b)<.00002f;}
        static bool Near(Vector3 a,Vector3 b){return (a-b).sqrMagnitude<.000000002f;}
        static bool Near(Vector2 a,Vector2 b){return (a-b).sqrMagnitude<.000000002f;}
        static string VertexUVKey(Vector3 p,Vector2 uv)
        {
            return Math.Round(p.x*10000)+","+Math.Round(p.y*10000)+","+Math.Round(p.z*10000)+"/"+Math.Round(uv.x*10000)+","+Math.Round(uv.y*10000);
        }
        static void Count(Dictionary<string,int> map,string key)
        {int old;map.TryGetValue(key,out old);map[key]=old+1;}
        static Bounds ActualBounds(List<Vector3> vertices)
        {
            Need(vertices.Count>0,"Actual imported source vertices required.");var bounds=new Bounds(vertices[0],Vector3.zero);
            foreach(var p in vertices)bounds.Encapsulate(p);return bounds;
        }
        static double Volume(Mesh mesh,out float minimumDot)
        {
            var vertices=mesh.vertices;var indices=mesh.triangles;var normals=mesh.normals;double result=0;minimumDot=1;
            for(int i=0;i<indices.Length;i+=3)
            {
                var a=vertices[indices[i]];var b=vertices[indices[i+1]];var c=vertices[indices[i+2]];var cross=Vector3.Cross(b-a,c-a);
                Need(cross.sqrMagnitude>.00000001f,"No degenerate imported-source display triangles.");
                result+=Vector3.Dot(a,Vector3.Cross(b,c))/6.0;
                if(normals.Length==vertices.Length)
                {
                    var n=(normals[indices[i]]+normals[indices[i+1]]+normals[indices[i+2]]).normalized;
                    minimumDot=Mathf.Min(minimumDot,Vector3.Dot(cross.normalized,n));
                }
                else minimumDot=-1;
            }
            return result;
        }
        public static void Run()
        {
            var report=new Report();GameObject built=null;
            try
            {
                Need(Application.isBatchMode,"Kit test must run only in the isolated background QA project.");
                string localKit=Path.Combine(DeliveryRoot,"kit");
                var contract=JsonUtility.FromJson<Contract>(File.ReadAllText(Path.Combine(localKit,"contracts.json")));
                Need(contract!=null&&contract.assets!=null&&contract.assets.Length==9,"Nine original sources in disk contract.");
                Need(contract.schemaVersion==1&&Near(contract.sourceVoxelMeters,.125f)&&Near(contract.unityAdapterYaw,180),"Explicit source unit and proper source-frame rotation.");
                report.kitId=contract.kitId;report.kitVersion=contract.version;
                var originals=contract.assets.ToDictionary(e=>e.id,e=>new[]{Sha(Path.Combine(localKit,e.source)),Sha(Path.Combine(localKit,e.fbx)),Sha(Path.Combine(localKit,e.palette))});
                SB03BridgeGeometry.PrepareKit();var plan=BridgeSolver.Solve(new BridgeSpec());Need(plan.Valid,"Default bridge solves for actual-source consumption.");
                built=SB03BridgeGeometry.Build(plan);string map=SB03BridgeGeometry.SourceMap(plan);
                Need(built.transform.localScale==Vector3.one,"Production display root has no extra scale.");
                var chunks=built.GetComponentsInChildren<SB03Chunk>(true);
                report.allNineSourcesUsed=contract.assets.All(e=>plan.Parts.Any(p=>p.SourceId==e.id));
                Need(report.allNineSourcesUsed,"Default single-arch bridge really uses all nine source roles.");
                foreach(var entry in contract.assets)
                {
                    var current=new SourceResult{id=entry.id,number=entry.number};report.sources.Add(current);
                    var hashes=originals[entry.id];current.nativeSha256=hashes[0];current.fbxSha256=hashes[1];current.paletteSha256=hashes[2];
                    Need(hashes[0]==entry.sourceSha256&&hashes[1]==entry.fbxSha256&&hashes[2]==entry.paletteSha256,"Original on-disk source hashes: "+entry.id);
                    string fbx=SB03BridgeGeometry.KitRoot+entry.fbx,png=SB03BridgeGeometry.KitRoot+entry.palette;
                    Need(Sha(fbx)==entry.fbxSha256&&Sha(png)==entry.paletteSha256,"Engine consumes byte-identical FBX/palette: "+entry.id);
                    var model=AssetDatabase.LoadAssetAtPath<GameObject>(fbx);Need(model!=null,"Real FBX imported: "+entry.id);
                    var instance=Object.Instantiate(model);instance.hideFlags=HideFlags.HideAndDontSave;
                    try
                    {
                        instance.transform.position=Vector3.zero;
                        var actual=new List<Vector3>();var filters=instance.GetComponentsInChildren<MeshFilter>(true);
                        var rotation=Matrix4x4.Rotate(Quaternion.Euler(0,entry.unityAdapterYaw,0));
                        current.sourceMeshCount=filters.Length;Need(filters.Length>0,"Source contains actual meshes.");
                        foreach(var filter in filters)
                        {
                            var mesh=filter.sharedMesh;Need(mesh!=null,"Actual source mesh exists.");
                            Need(mesh.uv.Length==mesh.vertexCount,"Actual source retains complete UV: "+entry.id);
                            Need(mesh.uv.All(v=>v.x>=0&&v.x<=1&&v.y>=0&&v.y<=1),"Actual source UV stays in palette.");
                            current.sourceVertices+=mesh.vertexCount;current.sourceTriangles+=mesh.triangles.Length/3;
                            var matrix=rotation*filter.transform.localToWorldMatrix;
                            actual.AddRange(mesh.vertices.Select(v=>matrix.MultiplyPoint3x4(v)));
                        }
                        current.completeUV=true;
                        var bounds=ActualBounds(actual);var s=entry.logicalSizeMeters;
                        current.actualBounds=new[]{bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z};
                        current.sourceEnvelopeCorrect=Near(bounds.min,new Vector3(-s[0]/2,0,-s[2]/2))&&Near(bounds.max,new Vector3(s[0]/2,s[1],s[2]/2));
                        Need(current.sourceEnvelopeCorrect,"Adapted real source envelope matches metres and bottom-centre contract: "+entry.id);
                        if(entry.id=="sb03.tread")
                        {
                            // Independent asymmetric measurement: lower heel occupies
                            // +X [0,.25]; full top nose reaches -.25.
                            var heel=ActualBounds(actual.Where(v=>v.y<.12499f).ToList());
                            var top=ActualBounds(actual.Where(v=>v.y>.24999f).ToList());
                            report.treadHeelPositiveX=Near(heel.min.x,0)&&Near(heel.max.x,.25f);
                            report.treadNoseNegativeX=Near(top.min.x,-.25f)&&Near(top.max.x,.25f)&&heel.min.x>top.min.x;
                            Need(report.treadHeelPositiveX&&report.treadNoseNegativeX,"Actual FBX asymmetric tread keeps heel +X and nose -X after one proper yaw.");
                        }
                        var expected=new Dictionary<string,int>();var parts=plan.Parts.Where(p=>p.SourceId==entry.id).ToArray();current.placements=parts.Length;
                        foreach(var part in parts)
                        {
                            var place=Matrix4x4.TRS(new Vector3(part.X,part.Y,part.Z),Quaternion.Euler(0,part.Yaw,0),Vector3.one)*rotation;
                            foreach(var filter in filters)
                            {
                                var mesh=filter.sharedMesh;var vertices=mesh.vertices;var uv=mesh.uv;var matrix=place*filter.transform.localToWorldMatrix;
                                // These source pieces each have one palette material.
                                // Count every submesh independently to match production
                                // CombineMeshes input while using actual source arrays.
                                for(int sub=0;sub<mesh.subMeshCount;sub++)
                                    for(int v=0;v<vertices.Length;v++)Count(expected,VertexUVKey(matrix.MultiplyPoint3x4(vertices[v]),uv[v]));
                            }
                        }
                        var matching=chunks.Where(c=>c.SourceId==entry.id).ToArray();Need(matching.Length==1,"Exactly one combined display chunk for "+entry.id);
                        var chunk=matching[0];var display=chunk.GetComponent<MeshFilter>().sharedMesh;var dv=display.vertices;var duv=display.uv;
                        current.displayVertices=dv.Length;current.displayTriangles=display.triangles.Length/3;
                        current.unitInstanceScale=chunk.transform.localScale==Vector3.one;Need(current.unitInstanceScale,"Display chunk has scale one.");
                        Need(duv.Length==dv.Length,"Combined mesh preserves palette UV length.");
                        var observed=new Dictionary<string,int>();for(int i=0;i<dv.Length;i++)Count(observed,VertexUVKey(dv[i],duv[i]));
                        current.actualVertexAndUVConsumption=expected.Count==observed.Count&&expected.All(kv=>observed.ContainsKey(kv.Key)&&observed[kv.Key]==kv.Value);
                        Need(current.actualVertexAndUVConsumption,"Combined display consumes exact original transformed vertices+UV, without arbitrary scaling or replacement: "+entry.id);
                        Need(current.displayTriangles==current.sourceTriangles*parts.Length,"Every placed source keeps its original triangle count.");
                        current.signedVolume=Volume(display,out current.minimumWindingDot);Need(current.signedVolume>0&&current.minimumWindingDot>.99f,"Display winding is outward and agrees with normals: "+entry.id);
                        var material=chunk.GetComponent<MeshRenderer>().sharedMaterial;var texture=material.mainTexture as Texture2D;
                        Need(texture!=null&&AssetDatabase.GetAssetPath(texture)==png,"Actual source palette assigned to source display chunk.");
                        current.paletteWidth=texture.width;current.paletteHeight=texture.height;
                        Need(texture.width>=16&&texture.height==16&&texture.filterMode==FilterMode.Point,"Actual palette dimensions and nearest sampling retained.");
                        current.sourceMapCorrect=chunk.SourcePath==fbx&&chunk.SourceSha256==entry.fbxSha256&&chunk.Placements==parts.Length&&map.Contains(entry.sourceSha256)&&map.Contains(entry.fbxSha256);
                        Need(current.sourceMapCorrect,"Display provenance and persisted source map retain original IDs/path/hashes/counts: "+entry.id);
                        current.sourceFilesUnchanged=hashes[0]==Sha(Path.Combine(localKit,entry.source))&&hashes[1]==Sha(Path.Combine(localKit,entry.fbx))&&hashes[2]==Sha(Path.Combine(localKit,entry.palette));
                        Need(current.sourceFilesUnchanged,"Engine verification does not alter original source files.");
                    }
                    finally{Object.DestroyImmediate(instance);}
                }
                report.status="PASS";
            }
            catch(Exception e){report.status="FAIL";report.error=e.ToString();UnityEngine.Debug.LogException(e);}
            finally
            {
                if(built!=null)SB03BridgeGeometry.DestroyGeometry(built);
                Directory.CreateDirectory(OutputRoot);File.WriteAllText(Path.Combine(OutputRoot,"kit-engine.json"),JsonUtility.ToJson(report,true));
            }
            Need(report.status=="PASS","SB03 actual imported kit verification failed; see kit-engine.json");
        }
    }
}
