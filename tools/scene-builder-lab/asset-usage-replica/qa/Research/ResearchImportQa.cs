using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using XingHai.BridgeReplica.Editor;
using XingHai.BridgeReplica.Research;

namespace XingHai.BridgeReplica.QA
{
    public static class ResearchImportQa
    {
        [Serializable] sealed class Report
        {
            public string status="FAIL",scope="Actual source JSON to persistent Unity Mesh assets; generated bridge and original-game T11 require separate proof.",kitPath,kitHash,changedKitPath,changedKitHash,restoredKitHash;
            public string baselineMesh,changedMesh,restoredMesh,error;
            public List<string> checks=new List<string>();
        }
        static void Need(bool pass,string text,Report report){if(!pass)throw new InvalidOperationException(text);report.checks.Add(text);}
        public static void Run()
        {
            string output=Environment.GetEnvironmentVariable("REPLICA_RESEARCH_OUTPUT");
            if(string.IsNullOrWhiteSpace(output)||!Path.IsPathRooted(output))throw new InvalidOperationException("Private absolute REPLICA_RESEARCH_OUTPUT required.");
            Directory.CreateDirectory(output);var report=new Report();
            try
            {
                string source=Environment.GetEnvironmentVariable("REPLICA_RESEARCH_SOURCE");
                if(string.IsNullOrWhiteSpace(source))throw new InvalidOperationException("Explicit REPLICA_RESEARCH_SOURCE required.");
                var kit=ResearchKitImporter.Import(source);ResearchKitImporter.Validate(kit);
                report.kitPath=AssetDatabase.GetAssetPath(kit);report.kitHash=kit.ContentHash;
                Need(kit.ResearchOnly&&kit.Bindings.Length==9,"research identity and explicit nine-role coverage",report);
                foreach(var pair in new[]{new{role="tread",file="stair_step.json",count=448},new{role="deck",file="stairs_step.json",count=300},new{role="rail",file="wooden_plank_straight.json",count=228}})
                {
                    var b=kit.Bindings.Single(x=>x.Role==pair.role);var native=ResearchMeshSource.Parse(File.ReadAllBytes(b.NativeSource));
                    Need(b.Mesh!=null&&b.Mesh.vertexCount==pair.count&&b.Mesh.triangles.Length==native.Indices.Length,"real Unity mesh for "+pair.role,report);
                    Need(File.Exists(b.AttributeArchivePath)&&File.ReadAllText(b.AttributeArchivePath).Contains(native.SourceSha256),"attribute archive and exact source SHA for "+pair.role,report);
                    Need(b.Mesh.normals.Length==pair.count&&b.Mesh.colors.Length==pair.count&&b.Mesh.uv.Length==pair.count,"converted normals/colors/UV arrays for "+pair.role,report);
                    if(pair.role=="rail")Need(Mathf.Abs(b.Mesh.bounds.min.y-.875f)<.0001f&&Mathf.Abs(b.Mesh.bounds.max.y-1f)<.0001f,"rail is a thin upper beam, not a full height panel",report);
                }
                Need(kit.Bindings.Where(x=>x.Role!="tread"&&x.Role!="deck"&&x.Role!="rail").All(x=>x.Usage!=null&&x.Usage.Contains("inherited")),"remaining six roles explicitly inherited from original A",report);
                string copy=Path.Combine(output,"controlled-source");Directory.CreateDirectory(copy);
                foreach(string file in new[]{"stair_step.json","stairs_step.json","wooden_plank_straight.json"})File.Copy(kit.Bindings.Single(x=>Path.GetFileName(x.NativeSource)==file).NativeSource,Path.Combine(copy,file),true);
                string changedFile=Path.Combine(copy,"stair_step.json");byte[] bytes=File.ReadAllBytes(changedFile);
                var before=ResearchMeshSource.Parse(bytes);report.baselineMesh=ResearchKitImporter.MeshFingerprint(kit.Bindings.Single(x=>x.Role=="tread").Mesh);
                const string from="-0.11423511803150177",to="0.08576488196849823";
                string json=Encoding.UTF8.GetString(bytes);int at=json.IndexOf(from,StringComparison.Ordinal);Need(at>=0,"controlled interior Y coordinate exists",report);
                try
                {
                    File.WriteAllText(changedFile,json.Substring(0,at)+to+json.Substring(at+from.Length),new UTF8Encoding(false));
                    // Keep the changed source snapshot immutable for root's later bridge comparison,
                    // while restoring the working copy below. No original installation file is written.
                    string snapshot=Path.Combine(output,"controlled-changed-snapshot");Directory.CreateDirectory(snapshot);
                    foreach(string file in new[]{"stair_step.json","stairs_step.json","wooden_plank_straight.json"})File.Copy(Path.Combine(copy,file),Path.Combine(snapshot,file),true);
                    var changed=ResearchKitImporter.Import(snapshot);report.changedKitPath=AssetDatabase.GetAssetPath(changed);report.changedKitHash=changed.ContentHash;report.changedMesh=ResearchKitImporter.MeshFingerprint(changed.Bindings.Single(x=>x.Role=="tread").Mesh);
                    Need(report.changedKitHash!=report.kitHash&&report.changedMesh!=report.baselineMesh,"private source Y edit changes persisted actual Mesh and kit content identity",report);
                }
                finally{File.WriteAllBytes(changedFile,bytes);}
                var restored=ResearchKitImporter.Import(copy);report.restoredKitHash=restored.ContentHash;report.restoredMesh=ResearchKitImporter.MeshFingerprint(restored.Bindings.Single(x=>x.Role=="tread").Mesh);
                Need(report.restoredKitHash==report.kitHash&&report.restoredMesh==report.baselineMesh,"restored exact bytes reproduce source identity and actual Unity Mesh",report);
                var loaded=AssetDatabase.LoadAssetAtPath<ReplicaKit>(report.kitPath);ResearchKitImporter.Validate(loaded);
                Need(loaded.Bindings.Single(x=>x.Role=="tread").Mesh!=null,"persistent Mesh reference resolves from saved kit asset",report);
                report.status="PASS";
            }
            catch(Exception e){report.error=e.ToString();throw;}
            finally{File.WriteAllText(Path.Combine(output,"unity-import-result.json"),JsonUtility.ToJson(report,true));}
        }
    }
}
