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
    public static class CurveResearchPrivacyQa
    {
        [Serializable] sealed class Check { public string name,status,error; }
        [Serializable] sealed class NativeProbe { public string path,exception; public bool attempted,returnedSuccess,fileWritten,guardCancelled; }
        [Serializable] sealed class Report { public string status,date,scope="Private actual source kit author/save/bake restrictions and actual AssetDatabase dependency closure. Original-game usage and physical mouse input are not certified."; public List<Check> checks=new List<Check>(); public NativeProbe nativeProbe=new NativeProbe(); public string[] disguisedSceneDependencies; public bool probeArtifactsCleaned; }
        static void Need(bool value,string message){if(!value)throw new Exception(message);}
        static void Case(Report r,string name,Action action){var c=new Check{name=name};try{action();c.status="PASS";}catch(Exception e){c.status="FAIL";c.error=e.ToString();}r.checks.Add(c);}
        static void RefusesWithoutWrite(Action action,string file)
        {Need(!File.Exists(file),"Fixture output already exists; use a fresh path.");bool refused=false;try{action();}catch(InvalidOperationException){refused=true;}Need(refused&&!File.Exists(file),"Research export was accepted or wrote the rejected target.");}
        public static void Run()
        {
            Need(Application.isBatchMode,"Use only the temporary background QA project.");var r=new Report{date=DateTimeOffset.Now.ToString("o")};
            string source=Environment.GetEnvironmentVariable("REPLICA_RESEARCH_SOURCE"),output=Environment.GetEnvironmentVariable("REPLICA_RESEARCH_OUTPUT");
            Need(!string.IsNullOrWhiteSpace(output),"REPLICA_RESEARCH_OUTPUT required, so the report cannot be written to public output.");
            // Scene replacement may unload unused native assets. Load the kit
            // after replacing the scene so this fixture keeps a live reference.
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);var kit=ResearchKitImporter.Import(source);
            var author=new GameObject("PrivateResearchCurve").AddComponent<ReplicaAuthor>();var session=ReplicaSession.Get(author);
            Case(r,"actual private source mesh used by valid committed route",()=>{Need(session.Preview(CurveExamples.S(),kit)&&session.ApplyNew(),session.Status);Need(author.Kit.ResearchOnly&&session.Geometry.GetComponentsInChildren<ReplicaChunk>().Any(c=>c.SourceId.StartsWith("research.")),"Research source did not reach actual committed chunks.");});
            if(author.Read()!=null)
            {
                string fresh=Guid.NewGuid().ToString("N"),publicPrefab="Assets/BridgeReplica/Baked/rejected-research-"+fresh+".prefab",publicScene="Assets/BridgeReplica/Scenes/rejected-research-"+fresh+".unity";
                string probeFolder="Assets/BridgeReplica/ResearchPrivacyProbe_"+fresh;
                string publicJson=Path.GetFullPath("Assets/BridgeReplica/rejected-research-"+fresh+".json");
                Case(r,"research prefab bake refuses before export",()=>RefusesWithoutWrite(()=>ReplicaFiles.Bake(author,publicPrefab),publicPrefab));
                Case(r,"research author file refuses public location",()=>RefusesWithoutWrite(()=>ReplicaFiles.SaveAuthor(author,publicJson),publicJson));
                Case(r,"research scene refuses public path before save",()=>RefusesWithoutWrite(()=>ReplicaFiles.SaveScene(publicScene),publicScene));
                Case(r,"research native persistence refuses public derived mesh path",()=>{bool refused=false;try{ReplicaFiles.PersistScene(author.gameObject.scene,publicScene);}catch(InvalidOperationException){refused=true;}Need(refused,"Native persistence accepted a public scene containing research kit.");});
                Case(r,"private author and native scene preserve editable exact meshes",()=>
                {
                    const string scene="Assets/BridgeReplica/ResearchPrivate/QA/ResearchCurve.unity";string json=Path.GetFullPath("Assets/BridgeReplica/ResearchPrivate/QA/ResearchCurve.bridge-route.json");
                    string original=author.DocumentJson,mesh=ReplicaGeometry.Fingerprint(session.Geometry);ReplicaFiles.SaveAuthor(author,json);ReplicaFiles.SaveScene(scene);
                    Need(author.GetComponentsInChildren<MeshFilter>().All(f=>AssetDatabase.GetAssetPath(f.sharedMesh).StartsWith("Assets/BridgeReplica/ResearchPrivate/",StringComparison.Ordinal)),"Private scene wrote a derived mesh outside ResearchPrivate.");
                    var restored=new GameObject("PrivateAuthorFileRestored").AddComponent<ReplicaAuthor>();try{ReplicaFiles.LoadAuthor(restored,json);Need(restored.DocumentJson==original&&ReplicaGeometry.Fingerprint(restored.gameObject)==mesh,"Private author cannot restore exact editable actual source meshes.");}finally{ReplicaGeometry.Destroy(restored.gameObject);}
                });
                // Break caught: checking entry names or ResearchOnly alone lets
                // a public scene distribute private assets through indirect
                // dependencies. These are real Unity-serialized fixture assets.
                Case(r,"public scene with publicly disguised research kit is rejected by actual closure",()=>
                {
                    const string privateScene="Assets/BridgeReplica/ResearchPrivate/QA/ResearchCurve.unity";
                    Need(File.Exists(privateScene),"Private scene fixture was not saved.");Need(!Directory.Exists(probeFolder),"Probe folder already exists.");ReplicaKitRegistry.Folder(probeFolder);
                    string publicKit=probeFolder+"/DisguisedKit.asset",scene=probeFolder+"/CopiedScene.unity",originalKit=AssetDatabase.GetAssetPath(kit);
                    Need(AssetDatabase.CopyAsset(originalKit,publicKit)&&AssetDatabase.CopyAsset(privateScene,scene),"Actual fixture assets could not be copied.");
                    // Rebind the copy's serialized kit GUID, just as a local
                    // asset move/copy can change its directory without changing
                    // its private Mesh/Material references. No dependency API
                    // is mocked and no original asset is edited.
                    string originalGuid=AssetDatabase.AssetPathToGUID(originalKit),publicGuid=AssetDatabase.AssetPathToGUID(publicKit),text=File.ReadAllText(scene);
                    Need(text.Contains(originalGuid),"Copied scene is not readable Unity text or does not reference the kit.");File.WriteAllText(scene,text.Replace(originalGuid,publicGuid));AssetDatabase.ImportAsset(scene,ImportAssetOptions.ForceSynchronousImport);
                    r.disguisedSceneDependencies=AssetDatabase.GetDependencies(scene,true);
                    Need(r.disguisedSceneDependencies.Contains(publicKit),"Real scene dependency graph does not reach the publicly disguised kit.");
                    Need(r.disguisedSceneDependencies.Any(p=>p.StartsWith("Assets/BridgeReplica/ResearchPrivate/",StringComparison.Ordinal)),"Real scene fixture contains no private dependency.");
                    bool refused=false;try{ReplicaPublicExport.ValidateClosure(new[]{scene});}catch(InvalidOperationException){refused=true;}Need(refused,"Public export accepted a scene reaching a publicly disguised research kit.");
                    var disguised=AssetDatabase.LoadAssetAtPath<ReplicaKit>(publicKit);disguised.ResearchOnly=false;EditorUtility.SetDirty(disguised);AssetDatabase.SaveAssets();
                    refused=false;try{ReplicaPublicExport.ValidateClosure(new[]{scene});}catch(InvalidOperationException){refused=true;}Need(refused,"Clearing ResearchOnly bypassed the actual private dependency closure check.");
                });
                // Characterize the engine's direct native SaveScene path. A
                // thrown sceneSaving callback does not, by itself, prove that
                // Unity cancelled serialization. If a file appears this case
                // is FAIL, even though the package closure rejects it later.
                Case(r,"native SaveScene actually cancels public serialization",()=>
                {
                    ReplicaKitRegistry.Folder(probeFolder);string nativePath=probeFolder+"/NativeBypass.unity";Need(!File.Exists(nativePath),"Native probe target already exists.");
                    r.nativeProbe.path=nativePath;r.nativeProbe.attempted=true;
                    try{r.nativeProbe.returnedSuccess=EditorSceneManager.SaveScene(author.gameObject.scene,nativePath,false);}catch(Exception e){r.nativeProbe.exception=e.ToString();}
                    r.nativeProbe.fileWritten=File.Exists(nativePath);r.nativeProbe.guardCancelled=!r.nativeProbe.fileWritten;
                    Need(r.nativeProbe.guardCancelled,"Native SaveScene wrote the public scene despite the guard; this is an actual native bypass, not a blocked/pass result.");
                });
                Case(r,"temporary public privacy probes cleaned after recording actual result",()=>
                {
                    // Only our freshly created QA folder is removable; Unity
                    // DeleteAsset removes contained fixture copies, never the
                    // private dependencies referenced by those copies.
                    string full=Path.GetFullPath(probeFolder),assets=Path.GetFullPath(Application.dataPath)+Path.DirectorySeparatorChar;
                    Need(full.StartsWith(assets,StringComparison.OrdinalIgnoreCase)&&Path.GetFileName(full)=="ResearchPrivacyProbe_"+fresh,"Probe cleanup escaped its own project folder.");
                    EditorSceneManager.OpenScene("Assets/BridgeReplica/ResearchPrivate/QA/ResearchCurve.unity");
                    if(AssetDatabase.IsValidFolder(probeFolder))Need(AssetDatabase.DeleteAsset(probeFolder),"Failed to remove QA fixture assets.");
                    r.probeArtifactsCleaned=!Directory.Exists(full);Need(r.probeArtifactsCleaned,"QA public fixture folder remains.");
                });
            }
            r.status=r.checks.All(c=>c.status=="PASS")?"PASS":"FAIL";Directory.CreateDirectory(output);File.WriteAllText(Path.Combine(output,"curve-private-save-result.json"),JsonUtility.ToJson(r,true));Debug.Log("CURVE_PRIVATE_SAVE "+r.status);EditorApplication.Exit(r.status=="PASS"?0:1);
        }
    }
}
