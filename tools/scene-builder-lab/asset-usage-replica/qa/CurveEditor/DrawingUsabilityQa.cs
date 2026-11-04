using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // The break under test is ordinary dense pointer input leaving a stale
    // half-metre fragment, or a second stroke creating an overlapping author.
    // This drives the actual Window, Mesh and Collider; it is not a physical
    // mouse test. SceneView hit testing has its own focused regression suite.
    public static class DrawingUsabilityQa
    {
        const string ScenePath="Assets/BridgeReplica/Scenes/DrawingUsability.unity";
        [Serializable] sealed class Check {public string name,status="PASS",error="";}
        [Serializable] sealed class StrokeFact
        {
            public string name,shape,lastStatus,lastRejection,error;
            public float jitter,referenceRadius,endpointError,maxEligibleEndpointLag,maxSourceDeviation,previewMedianMs,previewP95Ms;
            public int inputSamples,eligibleUpdates,acceptedUpdates,visibleTrackedUpdates,lastAcceptedSample;
            public bool finalInputAccepted,committed;
            public Vector3 pointerEnd,committedEnd;
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,sourceHash,date;
            public string scope="Dense noisy traces through actual Window input, real source meshes/colliders, same-author two-stroke first/last continuation, native Undo and independent saved-scene reopen. Background input is not physical mouse proof.";
            public bool physicalInput=false;
            public float width=2,sourcePositionTolerance=.1f,minimumTrackedUpdateRatio=.9f;
            public int successfulDenseTraces,traceCount;
            public List<Check> checks=new List<Check>();
            public List<StrokeFact> strokes=new List<StrokeFact>();
        }
        [Serializable] sealed class Expected
        {public string scene,authorName,document,mapping,mesh,kitPath,sourceHash;public Vector3 first,last;}
        static Report report;
        static string Root {get{return Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");}}
        static void Need(bool condition,string error){if(!condition)throw new InvalidOperationException(error);}
        static string SourceHash()
        {
            string dir=Path.Combine(Application.dataPath,"BridgeReplica");
            var files=Directory.GetFiles(dir,"*.cs",SearchOption.AllDirectories).Where(f=>!f.Replace('\\','/').Contains("/Editor/QA/")).OrderBy(f=>f,StringComparer.Ordinal);
            return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(string.Join("\n",files.Select(f=>"Assets/"+Path.GetFullPath(f).Substring(Path.GetFullPath(Application.dataPath).Length+1).Replace('\\','/')+"|"+ReplicaKitRegistry.HashFile(f)).ToArray())));
        }
        static void Case(string name,Action action)
        {
            var c=new Check{name=name};try{action();}catch(Exception e){c.status="FAIL";c.error=e.GetBaseException().ToString();}
            report.checks.Add(c);Debug.Log("DRAWING_USABILITY "+name+" "+c.status+" "+c.error);
        }
        static void Finish(string file)
        {
            report.status=report.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,"reports",file),JsonUtility.ToJson(report,true));
            EditorApplication.Exit(report.status=="PASS"?0:1);
        }
        static ReplicaAuthor[] Authors(){return UnityEngine.Object.FindObjectsOfType<ReplicaAuthor>().Where(a=>a.Read()!=null).ToArray();}
        static GameObject Geometry(ReplicaAuthor a){return a.transform.Find("__RouteGeometry").gameObject;}
        static string Mesh(ReplicaAuthor a){return ReplicaGeometry.Fingerprint(Geometry(a));}
        static Vector3 World(ReplicaAuthor a,RouteNode n){return a.transform.TransformPoint(new Vector3(n.X,n.Y,n.Z));}
        static Vector3 End(ReplicaAuthor a,bool first=false){return World(a,first?a.Read().Nodes.First():a.Read().Nodes.Last());}
        static float Horizontal(Vector3 a,Vector3 b){return new Vector2(a.x-b.x,a.z-b.z).magnitude;}
        static float PointSegment(Vector3 p,RouteNode a,RouteNode b)
        {
            float dx=b.X-a.X,dz=b.Z-a.Z,den=dx*dx+dz*dz,t=den<.000001f?0:Mathf.Clamp01(((p.x-a.X)*dx+(p.z-a.Z)*dz)/den);
            return new Vector2(p.x-a.X-dx*t,p.z-a.Z-dz*t).magnitude;
        }
        static void NewScene()
        {Selection.activeGameObject=null;EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Undo.ClearAll();}
        static void DisposeWindow(ReplicaWindow window)
        {if(window!=null){window.CancelInput();UnityEngine.Object.DestroyImmediate(window);}}
        static void ClearAuthors()
        {foreach(var a in Resources.FindObjectsOfTypeAll<ReplicaAuthor>().Where(a=>a!=null&&a.gameObject.scene.IsValid()).ToArray())ReplicaGeometry.Destroy(a.gameObject);}
        static ReplicaAuthor PreviewAuthor()
        {return Resources.FindObjectsOfTypeAll<ReplicaAuthor>().FirstOrDefault(a=>a!=null&&a.gameObject.scene.IsValid()&&a.transform.Find("__RoutePreview")!=null);}

        // Fixed seeds and nonuniform 0.05--0.16m sampling model hand input;
        // expectations are literal final points and independent distances, not
        // another call to the production simplifier/solver.
        static List<Vector3> Trace(string shape,float amplitude,int seed,bool backtrack)
        {
            var random=new System.Random(seed);var points=new List<Vector3>();float s=0,length=shape=="line"?18:shape=="arc"?(float)(6*Math.PI*2/3):24;int i=0;
            while(s<length)
            {
                float x,z,nx,nz;
                if(shape=="line"){x=s*.813f;z=s*.582f;nx=-.582f;nz=.813f;}
                else if(shape=="arc"){double angle=s/6;x=(float)(6*Math.Sin(angle));z=(float)(6*(1-Math.Cos(angle)));nx=-(float)Math.Sin(angle);nz=(float)Math.Cos(angle);}
                else{x=s;z=(float)(1.6*Math.Sin(s/4));double dz=.4*Math.Cos(s/4),norm=Math.Sqrt(1+dz*dz);nx=(float)(-dz/norm);nz=(float)(1/norm);}
                float noise=i==0?0:(float)((random.NextDouble()*2-1)*amplitude);points.Add(new Vector3(x+nx*noise,0,z+nz*noise));
                if(backtrack&&i>0&&i%47==0)points.Add(Vector3.Lerp(points.Last(),points[points.Count-2],.2f));
                s+=.05f+(float)random.NextDouble()*.11f;i++;
            }
            if(shape=="line")points.Add(new Vector3(length*.813f,0,length*.582f));
            else if(shape=="arc"){double angle=length/6;points.Add(new Vector3((float)(6*Math.Sin(angle)),0,(float)(6*(1-Math.Cos(angle)))));}
            else points.Add(new Vector3(length,0,(float)(1.6*Math.Sin(length/4))));return points;
        }
        static void DenseTrace(int index,string shape,float jitter,bool backtrack)
        {
            NewScene();ReplicaWindow window=null;var fact=new StrokeFact{name="dense-"+index,shape=shape,jitter=jitter,referenceRadius=shape=="arc"?6:shape=="s"?10:999};report.strokes.Add(fact);
            try
            {
                window=ScriptableObject.CreateInstance<ReplicaWindow>();var points=Trace(shape,jitter,7100+index,backtrack);fact.inputSamples=points.Count;fact.pointerEnd=points.Last();window.BeginDraw(points[0]);float rawLength=0;var costs=new List<float>();bool final=false;
                for(int i=1;i<points.Count;i++)
                {
                    rawLength+=Horizontal(points[i],points[i-1]);var clock=System.Diagnostics.Stopwatch.StartNew();bool accepted=window.DragDraw(points[i]);clock.Stop();costs.Add((float)clock.Elapsed.TotalMilliseconds);
                    if(accepted){fact.acceptedUpdates++;fact.lastAcceptedSample=i;}else fact.lastRejection=window.Status;
                    if(i==points.Count-1)final=accepted;
                    // The first 0.6m allows the documented 0.5m minimum plus
                    // centimetre jitter; all later updates must track input.
                    if(rawLength<.6f)continue;fact.eligibleUpdates++;
                    var a=PreviewAuthor();float lag=rawLength;
                    if(a!=null)
                    {
                        var preview=a.transform.Find("__RoutePreview").gameObject;var candidate=ReplicaSession.Get(a).Candidate;
                        if(candidate!=null&&candidate.Document!=null)
                        {
                            lag=Horizontal(World(a,candidate.Document.Nodes.Last()),points[i]);
                            bool visible=preview.activeInHierarchy&&preview.GetComponentsInChildren<MeshRenderer>().Any(m=>m.enabled)&&preview.GetComponentsInChildren<MeshFilter>().Any(f=>f.sharedMesh!=null&&f.sharedMesh.vertexCount>0);
                            if(visible&&lag<=.35f)fact.visibleTrackedUpdates++;
                        }
                    }
                    fact.maxEligibleEndpointLag=Mathf.Max(fact.maxEligibleEndpointLag,lag);
                }
                fact.finalInputAccepted=final;fact.committed=window.EndDraw();fact.lastStatus=window.Status;
                Need(fact.committed&&window.Author!=null,"dense trace did not commit: "+fact.lastStatus);
                var author=window.Author;var d=author.Read();fact.committedEnd=End(author);fact.endpointError=Horizontal(fact.committedEnd,fact.pointerEnd);
                fact.maxSourceDeviation=points.Max(p=>Enumerable.Range(0,d.Nodes.Count-1).Min(i=>PointSegment(p-points[0],d.Nodes[i],d.Nodes[i+1])));
                costs.Sort();fact.previewMedianMs=costs[costs.Count/2];fact.previewP95Ms=costs[Math.Min(costs.Count-1,(int)(costs.Count*.95f))];
                Need(final&&fact.endpointError<=.1f,"last input lost; pointer="+fact.pointerEnd+", actual="+fact.committedEnd+", last accepted sample="+fact.lastAcceptedSample+", rejection="+fact.lastRejection);
                Need(fact.maxSourceDeviation<=.1f,"path deviates from input by "+fact.maxSourceDeviation+"m");
                Need(fact.visibleTrackedUpdates>=fact.eligibleUpdates*.9f,"only "+fact.visibleTrackedUpdates+"/"+fact.eligibleUpdates+" actual mesh previews track the pointer; last rejection="+fact.lastRejection);
                Need(fact.maxEligibleEndpointLag<=.35f,"pointer outran last valid bridge by "+fact.maxEligibleEndpointLag+"m");
                Need(Authors().Length==1&&d.SchemaVersion==2,"one freehand stroke left multiple or legacy authors");report.successfulDenseTraces++;
            }
            catch(Exception e){fact.error=e.GetBaseException().Message;throw;}
            finally{DisposeWindow(window);ClearAuthors();}
        }
        static void KeepOldData(RouteDocument before,RouteDocument after,ReplicaKit kit,ReplicaAuthor author)
        {
            Need(after.Id==before.Id&&author.Kit==kit,"continuation changed route identity or kit");
            foreach(var n in before.Nodes){var found=after.Nodes.SingleOrDefault(p=>p.Id==n.Id);Need(found!=null&&JsonUtility.ToJson(found)==JsonUtility.ToJson(n),"continuation moved or replaced existing control node "+n.Id);}
            Need(JsonUtility.ToJson(new OpeningList{items=before.Openings.ToArray()})==JsonUtility.ToJson(new OpeningList{items=after.Openings.ToArray()}),"continuation changed existing bridge opening identity or parameters");
            Need(Authors().Length==1&&author.transform.Cast<Transform>().Count(t=>t.name=="__RouteGeometry")==1,"continuation left an independent bridge object");
        }
        [Serializable] sealed class OpeningList{public RouteOpening[] items;}
        static int SeamRays(ReplicaAuthor author,float joinX)
        {
            Physics.SyncTransforms();var colliders=author.GetComponentsInChildren<ReplicaChunk>().Where(c=>c.Role=="deck"||c.Role=="tread").Select(c=>c.GetComponent<Collider>()).ToArray();int checkedRays=0;
            for(int i=0;i<=32;i++)foreach(float z in new[]{-.85f,0,.85f})
            {var ray=new Ray(new Vector3(joinX-.8f+i*.05f,12,z),Vector3.down);RaycastHit hit;Need(colliders.Any(c=>c.Raycast(ray,out hit,20)),"actual walking collider seam gap x="+(joinX-.8f+i*.05f)+", z="+z);checkedRays++;}return checkedRays;
        }
        static ReplicaAuthor TwoStrokeContinuation()
        {
            NewScene();ReplicaWindow window=null;ReplicaAuthor author=null;
            try
            {
                window=ScriptableObject.CreateInstance<ReplicaWindow>();window.BeginDraw(Vector3.zero);
                for(int i=1;i<=140;i++)window.DragDraw(new Vector3(i*.1f,0,0));Need(window.EndDraw(),"first actual 14m drawn stroke failed: "+window.Status);author=window.Author;
                var doc=author.Read();int flat=Enumerable.Range(0,doc.Nodes.Count-1).First(i=>Mathf.Abs(doc.Nodes[i].Y-2)<.001f&&Mathf.Abs(doc.Nodes[i+1].Y-2)<.001f&&Mathf.Abs(doc.Nodes[i+1].X-doc.Nodes[i].X)>=5.9f);
                doc.Openings.Add(new RouteOpening{SegmentId=RouteDocument.GetSegmentId(doc.Nodes[flat].Id,doc.Nodes[flat+1].Id),Width=2,Height=1.25f});
                var session=ReplicaSession.Get(author);Need(session.Preview(doc,author.Kit)&&session.Apply(),session.Status);window.Select(author);Undo.ClearAll();
                Case("second stroke from off-centre tail fuses one author and collision surface",()=>
                {
                    var before=author.Read();string beforeJson=author.DocumentJson,beforeMesh=Mesh(author);var kit=author.Kit;var end=End(author);
                    // A point inside a 2m-wide end face, not the centre target.
                    window.BeginDraw(end+new Vector3(0,0,.8f));var random=new System.Random(902);
                    for(int i=1;i<=40;i++)window.DragDraw(end+new Vector3(i*.1f,0,i==40?0:(float)(random.NextDouble()-.5)*.035f));
                    Need(window.EndDraw(),"off-centre tail stroke failed: "+window.Status);Need(window.Author==author,"tail gesture made another author");KeepOldData(before,author.Read(),kit,author);
                    Need(Horizontal(End(author),new Vector3(18,0,0))<.1f,"tail gesture did not reach x=18");Need(SeamRays(author,14)==99,"tail seam probe count");
                    string after=author.DocumentJson,afterMesh=Mesh(author);Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(author.DocumentJson==beforeJson&&Mesh(author)==beforeMesh,"one Undo did not restore the entire tail extension");
                    Undo.PerformRedo();Need(author.DocumentJson==after&&Mesh(author)==afterMesh,"one Redo did not restore the tail extension");window.Select(author);
                });
                Case("third stroke from off-centre first endpoint prepends same author",()=>
                {
                    var before=author.Read();string beforeJson=author.DocumentJson,beforeMesh=Mesh(author);var kit=author.Kit;var start=End(author,true);Undo.ClearAll();
                    window.BeginDraw(start+new Vector3(0,0,-.8f));for(int i=1;i<=40;i++)window.DragDraw(start+new Vector3(-i*.1f,0,i==40?0:Mathf.Sin(i*1.71f)*.018f));
                    Need(window.EndDraw(),"off-centre first endpoint stroke failed: "+window.Status);Need(window.Author==author,"first endpoint gesture made another author");KeepOldData(before,author.Read(),kit,author);
                    Need(Horizontal(End(author,true),new Vector3(-4,0,0))<.1f,"prepended gesture did not reach x=-4");Need(SeamRays(author,0)==99,"first endpoint seam probe count");
                    string after=author.DocumentJson,afterMesh=Mesh(author);Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(author.DocumentJson==beforeJson&&Mesh(author)==beforeMesh,"one Undo did not restore the entire first-end extension");
                    Undo.PerformRedo();Need(author.DocumentJson==after&&Mesh(author)==afterMesh,"one Redo did not restore the first-end extension");window.Select(author);
                });
                return author;
            }
            finally{DisposeWindow(window);}
        }
        static void ExactStairs(float length)
        {
            var doc=new RouteDocument{SchemaVersion=2,Id="drawing-stair-"+length,Width=2,Rails=false,KitId="workshop.bridge.A",KitVersion="1"};
            doc.Nodes.Add(new RouteNode{Id="a",X=0,Y=0});doc.Nodes.Add(new RouteNode{Id="b",X=4,Y=2});doc.Nodes.Add(new RouteNode{Id="c",X=length-4,Y=2});doc.Nodes.Add(new RouteNode{Id="d",X=length,Y=0});GameObject root=null;
            try
            {
                root=ReplicaGeometry.Build(ReplicaRoute.Solve(doc),ReplicaKitRegistry.EnsureBase());Physics.SyncTransforms();var colliders=root.GetComponentsInChildren<ReplicaChunk>().Where(c=>c.Role=="tread").Select(c=>c.GetComponent<Collider>()).ToArray();
                Func<float,float> top=x=>{RaycastHit hit;foreach(var c in colliders)if(c.Raycast(new Ray(new Vector3(x,12,0),Vector3.down),out hit,20))return hit.point.y;throw new Exception("missing actual tread x="+x);};
                for(int i=0;i<8;i++){Need(Mathf.Abs(top(i*.5f+.25f)-(i+1)*.25f)<.001f,"ascending tread is not a 0.25m riser");Need(Mathf.Abs(top(length-4+i*.5f+.25f)-(8-i)*.25f)<.001f,"descending tread is not a 0.25m riser");}
            }finally{if(root!=null)ReplicaGeometry.Destroy(root);}
        }
        public static void Run()
        {
            Need(Application.isBatchMode,"Run only in the existing isolated background QA project");report=new Report{date=DateTimeOffset.Now.ToString("o"),sourceHash=SourceHash()};
            var shapes=new[]{"line","line","line","line","arc","arc","arc","arc","s","s","arc","arc"};var noise=new[]{0f,.012f,.02f,.03f,0f,.012f,.02f,.03f,.02f,.02f,.05f,.05f};
            report.traceCount=shapes.Length;for(int i=0;i<shapes.Length;i++){int n=i;Case("dense pointer trace "+n+" reaches final sample with continuing real mesh previews",()=>DenseTrace(n,shapes[n],noise[n],n==9));}
            Case("permitted 45 degree author turn has visible traversable mesh",()=>
            {
                var d=new RouteDocument{SchemaVersion=2,Id="drawing-45-degree",Width=2,KitId="workshop.bridge.A",KitVersion="1"};foreach(var p in new[]{new Vector3(0,2,0),new Vector3(8,2,0),new Vector3(14,2,6)})d.Nodes.Add(new RouteNode{Id="n"+d.Nodes.Count,X=p.x,Y=p.y,Z=p.z});
                var r=ReplicaRoute.Solve(d);Need(r.Valid,r.Message);var mesh=ReplicaGeometry.Build(r,ReplicaKitRegistry.EnsureBase());try
                {
                    Need(mesh.GetComponentsInChildren<MeshFilter>().All(f=>f.GetComponent<MeshCollider>().sharedMesh==f.sharedMesh),"permitted turn has a different collision surface");Physics.SyncTransforms();
                    var colliders=mesh.GetComponentsInChildren<ReplicaChunk>().Where(c=>c.Role=="deck"||c.Role=="tread").Select(c=>c.GetComponent<Collider>()).ToArray();
                    for(int i=0;i<=20;i++)foreach(float lateral in new[]{-.8f,0,.8f})
                    {
                        float s=-1+i*.1f;var centre=s<=0?new Vector3(8+s,12,0):new Vector3(8+s*.7071068f,12,s*.7071068f);var normal=s<=0?Vector3.forward:new Vector3(-.7071068f,0,.7071068f);RaycastHit hit;
                        Need(colliders.Any(c=>c.Raycast(new Ray(centre+normal*lateral,Vector3.down),out hit,20)),"permitted 45 degree join has a real walking surface gap, s="+s+", lateral="+lateral);
                    }
                }finally{ReplicaGeometry.Destroy(mesh);}
            });
            Case("exact 12m and 14m bridges preserve eight quarter-metre steps each side",()=>{ExactStairs(12);ExactStairs(14);});
            ReplicaAuthor finalAuthor=null;Case("actual separately drawn strokes prepare editable connected author",()=>{finalAuthor=TwoStrokeContinuation();});
            if(finalAuthor!=null)
            Case("connected drawn author persists exact native meshes and editable controls",()=>
            {
                Need(End(finalAuthor,true).x< -3.9f&&End(finalAuthor).x>17.9f,"saved bridge must contain both actual added strokes");
                var expected=new Expected{scene=ScenePath,authorName=finalAuthor.name,document=finalAuthor.DocumentJson,mapping=finalAuthor.MappingJson,mesh=Mesh(finalAuthor),kitPath=AssetDatabase.GetAssetPath(finalAuthor.Kit),sourceHash=report.sourceHash,first=End(finalAuthor,true),last=End(finalAuthor)};
                ReplicaFiles.SaveScene(ScenePath);Need(finalAuthor.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"native save left transient generated meshes");
                Directory.CreateDirectory(Path.Combine(Root,"reports"));File.WriteAllText(Path.Combine(Root,"reports/drawing-usability-expected.json"),JsonUtility.ToJson(expected,true));
            });
            Finish("drawing-usability.json");
        }
        public static void Reopen()
        {
            Need(Application.isBatchMode,"Run only in the existing isolated background QA project");report=new Report{date=DateTimeOffset.Now.ToString("o"),sourceHash=SourceHash()};
            Case("independent native reopen preserves connected author before any regeneration",()=>
            {
                var expected=JsonUtility.FromJson<Expected>(File.ReadAllText(Path.Combine(Root,"reports/drawing-usability-expected.json")));Need(expected.sourceHash==report.sourceHash,"production changed between save and independent reopen");EditorSceneManager.OpenScene(expected.scene);
                var authors=Authors();Need(authors.Length==1,"connected saved bridge reopened as multiple authors");var author=authors[0];Need(author.DocumentJson==expected.document&&author.MappingJson==expected.mapping,"reopened connected control data or mapping changed");
                Need(AssetDatabase.GetAssetPath(author.Kit)==expected.kitPath&&author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.Contains(f.sharedMesh)),"native saved kit or mesh dependencies missing");
                Need(Mesh(author)==expected.mesh,"persistent native mesh arrays differ before regeneration");Need(Horizontal(End(author,true),expected.first)<.001f&&Horizontal(End(author),expected.last)<.001f,"both connected endpoints did not survive native serialization");
                Need(SeamRays(author,0)==99&&SeamRays(author,14)==99,"independent reopen lost a walking seam");var session=ReplicaSession.Get(author);Need(session.Rebuild()&&Mesh(author)==expected.mesh,"same saved author cannot regenerate identical connected geometry");
                string before=author.DocumentJson,mesh=Mesh(author);var changed=author.Read();changed.Nodes.Last().X+=.5f;Undo.ClearAll();Need(session.Preview(changed,author.Kit)&&session.Apply(),session.Status);Undo.FlushUndoRecordObjects();Undo.PerformUndo();Need(author.DocumentJson==before&&Mesh(author)==mesh,"reopened connected bridge is not editable with one Undo");
            });
            Finish("drawing-usability-reopen.json");
        }
    }
}
