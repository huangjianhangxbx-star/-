using System;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;
using XingHai.BridgeReplica.Editor;
namespace XingHai.BridgeReplica.QA
{
    public static class CurveStairQa
    {
        [Serializable] sealed class Report{public string status="FAIL",error="";public float[] ascending,descending;public bool actualCollider=true;}
        public static void Red(){Run("red");}public static void Green(){Run("green");}
        static void Run(string name)
        {
            var r=new Report();GameObject root=null;
            try
            {
                var d=new RouteDocument{SchemaVersion=2,Id="exact14-stair-risers",Width=2,Rails=false,KitId="workshop.bridge.A",KitVersion="1"};
                d.Nodes.Add(new RouteNode{Id="a",X=0,Y=0});d.Nodes.Add(new RouteNode{Id="b",X=4,Y=2});d.Nodes.Add(new RouteNode{Id="c",X=10,Y=2});d.Nodes.Add(new RouteNode{Id="d",X=14,Y=0});
                root=ReplicaGeometry.Build(ReplicaRoute.Solve(d),ReplicaKitRegistry.EnsureBase());var colliders=root.GetComponentsInChildren<ReplicaChunk>().Where(c=>c.Role=="tread").Select(c=>c.GetComponent<Collider>()).ToArray();Physics.SyncTransforms();
                Func<float,float> top=x=>{RaycastHit hit;foreach(var c in colliders)if(c.Raycast(new Ray(new Vector3(x,10,0),Vector3.down),out hit,20))return hit.point.y;throw new Exception("missing tread x="+x);};
                r.ascending=Enumerable.Range(0,8).Select(i=>top(i*.5f+.25f)).ToArray();r.descending=Enumerable.Range(0,8).Select(i=>top(10+i*.5f+.25f)).ToArray();
                for(int i=0;i<8;i++)if(Mathf.Abs(r.ascending[i]-(i+1)*.25f)>.001f||Mathf.Abs(r.descending[i]-(8-i)*.25f)>.001f)throw new Exception("Actual 14m bridge must have eight 0.25m risers each side, not 0.5m jumps or duplicate steps.");
                r.status="PASS";
            }catch(Exception e){r.error=e.ToString();}finally{if(root!=null)ReplicaGeometry.Destroy(root);File.WriteAllText(Path.Combine(Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT"),"reports/v02-exact-stair-"+name+".json"),JsonUtility.ToJson(r,true));}
            EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
