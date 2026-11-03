using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
namespace XingHai.BridgeReplica.QA
{
    public static class ReplicaAcceptance
    {
        public static void InitialRed()
        {
            string[] names={"ReplicaAuthor","ReplicaKit","ReplicaSession","ReplicaKitRegistry"};
            var missing=names.Where(n=>!AppDomain.CurrentDomain.GetAssemblies().Any(a=>a.GetTypes().Any(t=>t.Name==n))).ToArray();
            string folder=Environment.GetEnvironmentVariable("REPLICA_OUTPUT_ROOT");Directory.CreateDirectory(Path.Combine(folder,"reports"));
            File.WriteAllText(Path.Combine(folder,"reports/editor-initial-red.json"),"{\"status\":\""+(missing.Length==0?"PASS":"FAIL")+"\",\"missing\":\""+string.Join(",",missing)+"\"}");
            if(missing.Length>0)throw new InvalidOperationException("Missing editable route / replaceable kit feature: "+string.Join(",",missing));
        }
    }
}
