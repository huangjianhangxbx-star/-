using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace XingHai.LE01.Editor
{
    public static class LE02ValidationRun
    {
        [Serializable] sealed class Step { public string name,status,error; }
        [Serializable] sealed class Report { public string engine,utc,sourceHash,shaderHash,status="FAIL"; public List<Step> steps=new List<Step>(); }
        public static void Red()
        {
            var report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash(),shaderHash=LE02Evidence.ShaderHash()};
            foreach(var action in new Action[]{LE02EditorTests.RunRed,LE02PerfEditorTests.Run,LE02ResourceEditorTests.Run,LE02OverlayEditorTests.Run})
            {
                var step=new Step{name=action.Method.DeclaringType.Name+"."+action.Method.Name,status="PASS"};
                try{action();}catch(Exception error){step.status="FAIL";step.error=error.ToString();Debug.Log("LE02_EXPECTED_RED "+step.name+": "+error.Message);}report.steps.Add(step);
            }
            string root=Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-02/reports");Directory.CreateDirectory(root);
            File.WriteAllText(Path.Combine(root,"editor-initial-red.json"),JsonUtility.ToJson(report,true));
        }
        public static void Integration()
        {
            var report=new Report{engine=Application.unityVersion,utc=DateTime.UtcNow.ToString("O"),sourceHash=LE01BEvidence.SourceHash(),shaderHash=LE02Evidence.ShaderHash()};
            bool failed=false;
            foreach(var action in new Action[]{LE02EditorTests.RunRed,LE02PerfEditorTests.Run,LE02ResourceEditorTests.Run,LE02OverlayEditorTests.Run,LE02Evidence.BuildExamples})
            {
                var step=new Step{name=action.Method.DeclaringType.Name+"."+action.Method.Name,status="PASS"};
                try{action();}catch(Exception error){failed=true;step.status="FAIL";step.error=error.ToString();Debug.LogException(error);}report.steps.Add(step);
            }
            string root=Path.Combine(Directory.GetParent(LE01Export.TaskRoot).FullName,"LE-02/reports");Directory.CreateDirectory(root);
            report.status=failed?"FAIL":"PASS";File.WriteAllText(Path.Combine(root,"integration.json"),JsonUtility.ToJson(report,true));
            if(failed)throw new InvalidOperationException("LE02 integration failed; inspect reports/integration.json");
            Debug.Log("LE02_INTEGRATION_COMPLETE");
        }
        public static void ReopenAndMeasure()
        {
            LE02Evidence.Reopen();
            LE02StrokePerformance.Run();
        }
    }
}
