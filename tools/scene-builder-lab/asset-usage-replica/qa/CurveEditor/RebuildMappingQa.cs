using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // A removed deck record simulates an obsolete derived mapping cache. It
    // does not claim to reconstruct the old generator or original art. The
    // oracle below reads real generated meshes, not another call to Mapping().
    public static class RebuildMappingQa
    {
        [Serializable] sealed class Check
        {
            public string name,status="PASS",error,staleEvidence,undoCoverage,redoCoverage;
            public bool fixtureCovered,staleDetected,rebuildSucceeded,documentUnchanged,
                revisionUnchanged,undoDocumentExact,redoDocumentExact;
            public int originalRevision,roles,vertices,triangles,removedVertexCount,removedTriangleCount;
        }
        [Serializable] sealed class Report
        {
            public string status="FAIL",engine=Application.unityVersion,
                scope="Obsolete derived MappingJson cache simulation: remove one real deck placement, then actual Session.Rebuild and native Undo/Redo. Independent per-role index coverage against actual generated meshes; no Engine UI or physical input claim.";
            public List<Check> checks=new List<Check>();
        }
        static void Need(bool value,string message){if(!value)throw new InvalidOperationException("SYMPTOM: "+message);}
        static void FixtureNeed(bool value,string message){if(!value)throw new InvalidOperationException("FIXTURE: "+message);}
        static RouteDocument Route()
        {
            var d=new RouteDocument{SchemaVersion=2,Id="rebuild-derived-mapping",Width=2,KitId="workshop.bridge.A",KitVersion="1"};
            d.Nodes.Add(new RouteNode{Id="a",X=0,Y=2,Z=0});
            d.Nodes.Add(new RouteNode{Id="corner",X=8,Y=2,Z=0});
            d.Nodes.Add(new RouteNode{Id="end",X=12,Y=2,Z=4});return d;
        }
        sealed class Fixture:IDisposable
        {
            public ReplicaAuthor Author;public ReplicaSession Session;
            public Fixture()
            {
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);Undo.ClearAll();
                Author=new GameObject("Mapping_cache_45_degree_bridge").AddComponent<ReplicaAuthor>();Session=ReplicaSession.Get(Author);
                FixtureNeed(Session.Preview(Route(),ReplicaKitRegistry.EnsureBase())&&Session.ApplyNew(),"45 degree source bridge did not build: "+Session.Status);
                Undo.ClearAll();
            }
            public void Dispose(){if(Author!=null){Session.Cancel();UnityEngine.Object.DestroyImmediate(Author.gameObject);}Undo.ClearAll();}
        }
        static string Coverage(ReplicaAuthor author,Check fact=null)
        {
            try
            {
                var mapping=JsonUtility.FromJson<CurveMapping>(author.MappingJson);
                if(mapping==null||mapping.placements==null)throw new Exception("missing mapping placements");
                var root=author.transform.Find("__RouteGeometry");if(root==null)throw new Exception("missing actual committed geometry");
                var chunks=root.GetComponentsInChildren<ReplicaChunk>(true).Where(c=>c.Role!="generated-core").ToArray();
                if(chunks.Length==0)throw new Exception("no source role meshes");
                if(chunks.GroupBy(c=>c.Role).Any(g=>g.Count()!=1))throw new Exception("ambiguous role mesh batches");
                var roles=new HashSet<string>(chunks.Select(c=>c.Role));
                if(mapping.placements.Any(p=>p==null||!roles.Contains(p.role)))throw new Exception("mapping names an absent role mesh");
                int allVertices=0,allTriangles=0;
                foreach(var chunk in chunks)
                {
                    var filter=chunk.GetComponent<MeshFilter>();var mesh=filter==null?null:filter.sharedMesh;
                    if(mesh==null)throw new Exception(chunk.Role+": missing actual mesh");
                    int[] indices=mesh.triangles;int triangleCount=indices.Length/3;
                    var vertices=new bool[mesh.vertexCount];var triangles=new bool[triangleCount];
                    var rows=mapping.placements.Where(p=>p.role==chunk.Role).ToArray();
                    if(rows.Length!=chunk.Placements)throw new Exception(chunk.Role+": mapped placements "+rows.Length+" != actual source instances "+chunk.Placements);
                    foreach(var p in rows)
                    {
                        if(p.sourceId!=chunk.SourceId||p.sourceHash!=chunk.SourceHash)throw new Exception(chunk.Role+": wrong source identity");
                        if(p.vertexCount<=0||p.firstVertex<0||p.firstVertex>vertices.Length-p.vertexCount)throw new Exception(chunk.Role+": vertex range out of bounds");
                        if(p.triangleCount<=0||p.firstTriangle<0||p.firstTriangle>triangles.Length-p.triangleCount)throw new Exception(chunk.Role+": triangle range out of bounds");
                        for(int v=p.firstVertex;v<p.firstVertex+p.vertexCount;v++){if(vertices[v])throw new Exception(chunk.Role+": duplicate vertex coverage");vertices[v]=true;}
                        for(int t=p.firstTriangle;t<p.firstTriangle+p.triangleCount;t++)
                        {
                            if(triangles[t])throw new Exception(chunk.Role+": duplicate triangle coverage");triangles[t]=true;
                            for(int k=0;k<3;k++){int v=indices[t*3+k];if(v<p.firstVertex||v>=p.firstVertex+p.vertexCount)throw new Exception(chunk.Role+": placement triangle references another placement's vertices");}
                        }
                    }
                    if(vertices.Any(v=>!v)||triangles.Any(t=>!t))throw new Exception(chunk.Role+": mapping does not cover every actual vertex and triangle");
                    allVertices+=vertices.Length;allTriangles+=triangles.Length;
                }
                if(fact!=null){fact.roles=chunks.Length;fact.vertices=allVertices;fact.triangles=allTriangles;}
                return null;
            }
            catch(Exception e){return e.Message;}
        }
        static void MakeStale(ReplicaAuthor author,Check c)
        {
            var m=JsonUtility.FromJson<CurveMapping>(author.MappingJson);int last=Array.FindLastIndex(m.placements,p=>p.role=="deck");
            FixtureNeed(last>=0,"fixture has no deck placement to remove");
            c.removedVertexCount=m.placements[last].vertexCount;c.removedTriangleCount=m.placements[last].triangleCount;
            m.placements=m.placements.Where((p,i)=>i!=last).ToArray();author.MappingJson=JsonUtility.ToJson(m);
            c.staleEvidence=Coverage(author);c.staleDetected=c.staleEvidence!=null;FixtureNeed(c.staleDetected,"obsolete-cache simulation was not detected by the independent mesh oracle");
        }
        static Check Case(string name,Action<Fixture,Check> body)
        {
            var c=new Check{name=name};try{using(var f=new Fixture()){string error=Coverage(f.Author,c);FixtureNeed(error==null,"current generated mapping does not cover current actual mesh: "+error);c.fixtureCovered=true;body(f,c);}}
            catch(Exception e){var root=e.GetBaseException();c.status=root.Message.StartsWith("SYMPTOM:")?"FAIL":"ERROR";c.error=root.ToString();}return c;
        }
        public static void Red(){Run("rebuild-mapping-red");}
        public static void Green(){Run("rebuild-mapping-green");}
        static void Run(string filename)
        {
            if(!Application.isBatchMode)throw new InvalidOperationException("Use the isolated background QA project.");
            var r=new Report();
            r.checks.Add(Case("rebuild-repairs-obsolete-cache-without-editing-route",(f,c)=>
            {
                string document=f.Author.DocumentJson;c.originalRevision=f.Author.Read().Revision;MakeStale(f.Author,c);
                c.rebuildSucceeded=f.Session.Rebuild();c.documentUnchanged=f.Author.DocumentJson==document;c.revisionUnchanged=f.Author.Read().Revision==c.originalRevision;
                string coverage=Coverage(f.Author,c);
                Need(c.rebuildSucceeded,"rebuild failed: "+f.Session.Status);Need(c.documentUnchanged&&c.revisionUnchanged,"derived rebuild edited the saved route or revision");
                Need(coverage==null,"rebuilt mesh retained obsolete mapping ranges: "+coverage);
            }));
            r.checks.Add(Case("native-undo-restores-route-and-regenerates-obsolete-cache",(f,c)=>
            {
                string before=f.Author.DocumentJson;c.originalRevision=f.Author.Read().Revision;MakeStale(f.Author,c);
                var edited=f.Author.Read();edited.Nodes.Last().X+=2;edited.Nodes.Last().Z+=2;
                FixtureNeed(f.Session.Preview(edited,f.Author.Kit)&&f.Session.Apply(),"route edit did not commit: "+f.Session.Status);
                string after=f.Author.DocumentJson;FixtureNeed(Coverage(f.Author)==null,"edited current mesh has invalid mapping");
                Undo.FlushUndoRecordObjects();Undo.PerformUndo();c.undoDocumentExact=f.Author.DocumentJson==before;c.undoCoverage=Coverage(f.Author);
                Undo.PerformRedo();c.redoDocumentExact=f.Author.DocumentJson==after;c.redoCoverage=Coverage(f.Author,c);
                Need(c.undoDocumentExact&&c.redoDocumentExact,"native Undo/Redo did not restore exact route JSON including revision");
                Need(c.undoCoverage==null,"Undo rebuilt mesh with an obsolete mapping: "+c.undoCoverage);Need(c.redoCoverage==null,"Redo mapping differs from real mesh: "+c.redoCoverage);
            }));
            r.checks.Add(Case("native-redo-regenerates-obsolete-derived-field-without-route-edit",(f,c)=>
            {
                string document=f.Author.DocumentJson;c.originalRevision=f.Author.Read().Revision;
                Undo.IncrementCurrentGroup();int group=Undo.GetCurrentGroup();Undo.RecordObject(f.Author,"Simulate obsolete derived cache");MakeStale(f.Author,c);EditorUtility.SetDirty(f.Author);Undo.FlushUndoRecordObjects();Undo.CollapseUndoOperations(group);
                Undo.PerformUndo();c.undoDocumentExact=f.Author.DocumentJson==document;c.undoCoverage=Coverage(f.Author);
                Undo.PerformRedo();c.redoDocumentExact=f.Author.DocumentJson==document;c.redoCoverage=Coverage(f.Author,c);c.revisionUnchanged=f.Author.Read().Revision==c.originalRevision;
                Need(c.undoDocumentExact&&c.redoDocumentExact&&c.revisionUnchanged,"derived-cache Undo/Redo changed route authority or revision");
                Need(c.undoCoverage==null,"Undo mapping differs from real mesh: "+c.undoCoverage);Need(c.redoCoverage==null,"Redo retained obsolete mapping ranges: "+c.redoCoverage);
            }));
            r.status=r.checks.Any(c=>c.status=="ERROR")?"ERROR":r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";
            string output=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT")??throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required");Directory.CreateDirectory(Path.Combine(output,"reports"));File.WriteAllText(Path.Combine(output,"reports",filename+".json"),JsonUtility.ToJson(r,true));
            foreach(var c in r.checks)Debug.Log("REBUILD_MAPPING "+c.name+" "+c.status+" "+c.error);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
