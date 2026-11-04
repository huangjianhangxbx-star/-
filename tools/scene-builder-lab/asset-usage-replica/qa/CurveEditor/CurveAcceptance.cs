using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;
using XingHai.BridgeReplica.Editor;

namespace XingHai.BridgeReplica.QA
{
    // Initial red exercises the existing production path. No future curve API
    // is referenced, so a missing type or compilation error cannot be its red.
    public static class CurveAcceptance
    {
        [Serializable] sealed class Point { public float x,y,z; public Point(float x,float y,float z){this.x=x;this.y=y;this.z=z;} }
        [Serializable] sealed class InitialReport
        {
            public string status="ERROR",date,engine,sourceHash,error,scope;
            public string productionBreak="Free drawing converts a diagonal input into axis-aligned legs before rendering.";
            public float toleranceMeters=.1f,forwardDeviationMeters,reverseDeviationMeters;
            public int inputPoints,outputNodes,actualMeshChunks,actualVertices,actualTriangles,renderParts;
            public bool realProductionCalled,compileFailureCountsAsRed=false,physicalInput=false;
            public List<Point> input=new List<Point>(),authorCenterline=new List<Point>();
            public float[] actualSegmentYaw,actualPartYaw;
            public string actualMeshFingerprint,renderLimitation,coreRecipe;
        }
        static string Output { get { return Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT") ?? throw new InvalidOperationException("REPLICA_OUTPUT_ROOT required."); } }
        static string SourceHash()
        {
            var files=Directory.GetFiles(Path.Combine(Application.dataPath,"BridgeReplica"),"*.cs",SearchOption.AllDirectories)
                .Where(p=>!p.Replace('\\','/').Contains("/QA/")).OrderBy(p=>p,StringComparer.Ordinal);
            return ReplicaKitRegistry.Hash(Encoding.UTF8.GetBytes(string.Join("\n",files.Select(p=>File.ReadAllText(p).TrimStart('\uFEFF')).ToArray())));
        }
        static float DistanceToSegment(Vector3 p,Vector3 a,Vector3 b)
        {var d=b-a;float t=d.sqrMagnitude<.00000001f?0:Mathf.Clamp01(Vector3.Dot(p-a,d)/d.sqrMagnitude);return Vector3.Distance(p,a+t*d);}
        static float DirectedDeviation(IList<Vector3> from,IList<Vector3> to)
        {
            float worst=0;
            for(int i=0;i<from.Count-1;i++)for(int j=0;j<=100;j++)
            {
                var p=Vector3.Lerp(from[i],from[i+1],j/100f);float nearest=float.MaxValue;
                for(int k=0;k<to.Count-1;k++)nearest=Mathf.Min(nearest,DistanceToSegment(p,to[k],to[k+1]));
                worst=Mathf.Max(worst,nearest);
            }
            return worst;
        }
        public static void InitialRed()
        {
            var report=new InitialReport{date=DateTimeOffset.Now.ToString("o"),engine=Application.unityVersion,
                scope="v0.2 T1 targeted initial red; actual old RouteSketch, RouteSolver and rendered original A kit. Not a physical-input test."};
            GameObject built=null;
            try
            {
                if(!Application.isBatchMode)throw new InvalidOperationException("Run only in the isolated background QA project.");
                report.sourceHash=SourceHash();var samples=new List<RouteNode>();
                for(int i=0;i<5;i++){float n=i*5;samples.Add(new RouteNode{Id="input"+i,X=n,Y=0,Z=n});report.input.Add(new Point(n,0,n));}
                var doc=RouteSketch.Build(samples,0,2);report.realProductionCalled=true;report.inputPoints=samples.Count;report.outputNodes=doc.Nodes.Count;
                report.authorCenterline=doc.Nodes.Select(n=>new Point(n.X,n.Y,n.Z)).ToList();
                var input=samples.Select(n=>new Vector3(n.X,n.Y,n.Z)).ToArray();var output=doc.Nodes.Select(n=>new Vector3(n.X,n.Y,n.Z)).ToArray();
                report.forwardDeviationMeters=DirectedDeviation(input,output);report.reverseDeviationMeters=DirectedDeviation(output,input);
                var result=RouteSolver.Solve(doc);if(!result.Valid)throw new InvalidOperationException("Old renderer fixture rejected: "+result.Message);
                var kit=ReplicaKitRegistry.EnsureBase();built=ReplicaGeometry.Build(result,kit);var filters=built.GetComponentsInChildren<MeshFilter>();
                report.actualMeshChunks=filters.Length;report.actualVertices=filters.Sum(f=>f.sharedMesh.vertexCount);report.actualTriangles=filters.Sum(f=>f.sharedMesh.triangles.Length/3);
                report.actualMeshFingerprint=ReplicaGeometry.Fingerprint(built);report.renderParts=result.Plan.Parts.Count;
                report.actualSegmentYaw=result.Segments.Select(s=>s.Yaw).Distinct().OrderBy(y=>y).ToArray();
                report.actualPartYaw=result.Plan.Parts.Select(p=>p.Yaw).Distinct().OrderBy(y=>y).ToArray();
                report.coreRecipe=string.Join(",",built.GetComponentsInChildren<ReplicaChunk>().Where(c=>c.Role=="generated-core").Select(c=>c.SourceId).ToArray());
                report.renderLimitation="Actual Mesh is generated from the already orthogonalized route. Segment/part yaw values above expose discrete headings; existing support recipe is axis-aligned. Changing kit geometry after this plan cannot restore the input diagonal.";
                report.status=report.forwardDeviationMeters<=report.toleranceMeters&&report.reverseDeviationMeters<=report.toleranceMeters?"PASS":"FAIL";
            }
            catch(Exception e){report.error=e.ToString();report.status="ERROR";}
            finally
            {
                if(built!=null)ReplicaGeometry.Destroy(built);
                Directory.CreateDirectory(Path.Combine(Output,"reports"));File.WriteAllText(Path.Combine(Output,"reports/v02-initial-red.json"),JsonUtility.ToJson(report,true));
            }
            Debug.Log("CURVE_INITIAL_RED "+report.status+" forward="+report.forwardDeviationMeters+" reverse="+report.reverseDeviationMeters+" "+report.error);
            EditorApplication.Exit(report.status=="PASS"?0:1);
        }
    }
}
