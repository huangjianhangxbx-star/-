using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEditor;
using UnityEditor.SceneManagement;
using XingHai.BridgeReplica.Editor;
namespace XingHai.BridgeReplica.QA
{
    public static class CurveGeometryQa
    {
        [Serializable] sealed class Case
        {public string name,fingerprint;public float buildMs;public int vertices,triangles,deckRayChecks,deckRayMisses;}
        [Serializable] sealed class Report
        {public string status="FAIL",error="",scope="Real generated Mesh/Collider and source-kit comparison; background Engine, not physical mouse/T11.";public List<string> checks=new List<string>();public List<Case> cases=new List<Case>();public bool physicalInput=false;}
        static Report report;static string Output=>Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");
        static void Need(bool value,string text){if(!value)throw new Exception(text);report.checks.Add(text);}
        static GameObject Build(RouteDocument doc,ReplicaKit kit,string name)
        {
            var result=ReplicaRoute.Solve(doc);Need(result.Valid,name+" valid author route");var clock=System.Diagnostics.Stopwatch.StartNew();var root=ReplicaGeometry.Build(result,kit);clock.Stop();
            var c=new Case{name=name,buildMs=(float)clock.Elapsed.TotalMilliseconds,fingerprint=ReplicaGeometry.Fingerprint(root)};
            var filters=root.GetComponentsInChildren<MeshFilter>();c.vertices=filters.Sum(x=>x.sharedMesh.vertexCount);c.triangles=filters.Sum(x=>x.sharedMesh.triangles.Length/3);
            Need(filters.All(f=>f.sharedMesh==f.GetComponent<MeshCollider>().sharedMesh),name+" visible meshes and collision share actual geometry");
            Physics.SyncTransforms();var decks=filters.Where(f=>f.name=="deck"||f.name=="tread").Select(f=>f.GetComponent<Collider>()).ToArray();
            for(float arc=.12f;arc<result.Curve.Length-.05f;arc+=.193f)
            foreach(float side in new[]{-.45f,0,.45f})
            {
                var f=result.Curve.FrameAt(arc);var point=new Vector3(f.X+(f.LeftX-f.RightX)*side,20,f.Z+(f.LeftZ-f.RightZ)*side);var ray=new Ray(point,Vector3.down);RaycastHit hit;
                c.deckRayChecks++;if(!decks.Any(d=>d.Raycast(ray,out hit,30)))c.deckRayMisses++;
            }
            report.cases.Add(c);Need(c.deckRayMisses==0,name+" walking surface has no sampled inside/outside curve cracks ("+c.deckRayChecks+" rays)");
            var mapping=JsonUtility.FromJson<CurveMapping>(ReplicaGeometry.Mapping(result,kit));
            Need(mapping.route.SchemaVersion==2&&mapping.placements.All(p=>p.vertexCount>0&&p.triangleCount>0&&!string.IsNullOrEmpty(p.sourceHash)),name+" actual part source and vertex ranges recorded");
            Capture(root,name);return root;
        }
        static void Capture(GameObject root,string name)
        {
            string dir=Path.Combine(Output,"samples/curve-v02");Directory.CreateDirectory(dir);var bounds=new Bounds();bool first=true;
            foreach(var r in root.GetComponentsInChildren<Renderer>()){if(first){bounds=r.bounds;first=false;}else bounds.Encapsulate(r.bounds);}
            var go=new GameObject("Curve_QA_Camera");var cam=go.AddComponent<Camera>();cam.orthographic=true;cam.orthographicSize=Mathf.Max(bounds.extents.x,bounds.extents.z)*.88f+3;cam.aspect=1.6f;cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=new Color(.59f,.69f,.73f);cam.nearClipPlane=.1f;cam.farClipPlane=300;cam.allowHDR=false;cam.allowMSAA=false;cam.transform.position=bounds.center+new Vector3(-24,28,-28);cam.transform.LookAt(bounds.center);
            var rt=new RenderTexture(1440,900,24);var tex=new Texture2D(1440,900,TextureFormat.RGB24,false);var old=RenderTexture.active;
            try{cam.targetTexture=rt;cam.Render();cam.Render();RenderTexture.active=rt;tex.ReadPixels(new Rect(0,0,1440,900),0,0);tex.Apply();File.WriteAllBytes(Path.Combine(dir,name+".png"),tex.EncodeToPNG());}
            finally{RenderTexture.active=old;cam.targetTexture=null;UnityEngine.Object.DestroyImmediate(tex);UnityEngine.Object.DestroyImmediate(rt);UnityEngine.Object.DestroyImmediate(go);}
        }
        public static void Run()
        {
            report=new Report();var roots=new List<GameObject>();
            try
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.55f,.55f,.55f);RenderSettings.skybox=null;
                var light=new GameObject("Curve_QA_Light").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.1f;light.transform.rotation=Quaternion.Euler(48,-35,0);
                var kit=ReplicaKitRegistry.EnsureBase();
                foreach(var doc in new[]{CurveExamples.Diagonal(),CurveExamples.C(),CurveExamples.U(),CurveExamples.S()})
                {var root=Build(doc,kit,doc.Id.Replace("curve.","A-"));roots.Add(root);root.SetActive(false);}
                var u=CurveExamples.U();var result=ReplicaRoute.Solve(u);var bridge=ReplicaGeometry.Build(result,kit);roots.Add(bridge);Physics.SyncTransforms();
                var opening=result.Curve.Openings.Single();var at=result.Curve.FrameAt((opening.StartArc+opening.EndArc)*.5f);var origin=new Vector3(at.X-at.NormalX*5,.5f,at.Z-at.NormalZ*5);var ray=new Ray(origin,new Vector3(at.NormalX,0,at.NormalZ));RaycastHit hit;
                Need(!bridge.GetComponentsInChildren<Collider>().Any(c=>c.Raycast(ray,out hit,10)),"straight arch is an actual traversable collider hole");
                var solidAt=result.Curve.FrameAt(opening.StartArc-1);var solidRay=new Ray(new Vector3(solidAt.X-solidAt.NormalX*5,.5f,solidAt.Z-solidAt.NormalZ*5),new Vector3(solidAt.NormalX,0,solidAt.NormalZ));
                Need(bridge.GetComponentsInChildren<Collider>().Any(c=>c.Raycast(solidRay,out hit,10)),"support next to arch remains solid");bridge.SetActive(false);
                var b=ReplicaKitRegistry.Register(Path.Combine(Output,"kits/B/kit-manifest.json"));var bRoot=Build(u,b,"B-U-radius6");roots.Add(bRoot);bRoot.SetActive(false);
                Need(report.cases.Single(c=>c.name=="A-U-radius6").fingerprint!=report.cases.Last().fingerprint,"A/B same author and geometry recipe consume different real source meshes");
                // Legacy route is still solved by the old implementation; no migration.
                var legacy=RouteExamples.Detour();var old=RouteSolver.Solve(legacy);var dispatch=ReplicaRoute.Solve(legacy);
                var oldRoot=ReplicaGeometry.Build(old,kit);var dispatchRoot=ReplicaGeometry.Build(dispatch,kit);roots.Add(oldRoot);roots.Add(dispatchRoot);
                Need(dispatch.Curve==null&&ReplicaGeometry.Fingerprint(oldRoot)==ReplicaGeometry.Fingerprint(dispatchRoot),"schema1 retains exact old generated shape");
                report.status="PASS";
            }
            catch(Exception e){report.error=e.ToString();}
            finally{foreach(var root in roots)if(root!=null)ReplicaGeometry.Destroy(root);Directory.CreateDirectory(Path.Combine(Output,"reports"));File.WriteAllText(Path.Combine(Output,"reports/v02-real-geometry.json"),JsonUtility.ToJson(report,true));}
            Debug.Log("CURVE_GEOMETRY "+report.status+" "+report.error);EditorApplication.Exit(report.status=="PASS"?0:1);
        }
    }
}
