using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace XingHai.LE01.Editor
{
    // Background orchestration for this research project; no automatic startup or external commands.
    public static class LE01CValidationRun
    {
        [Serializable] sealed class Step { public string name, status, error; public double milliseconds; }
        [Serializable] sealed class Report
        {
            public string engine, utc, sourceHash, status = "PASS";
            public string input = "Background Editor APIs and production controller; physical interaction is recorded separately.";
            public List<Step> steps = new List<Step>();
        }
        public static void Integration()
        {
            var report = new Report { engine = Application.unityVersion, utc = DateTime.UtcNow.ToString("O"), sourceHash = LE01BEvidence.SourceHash() };
            var actions = new Action[] { LE01CUsabilityTests.Run, LE01CPerfEditorTests.Run, LE01CEditorTests.RunTargeted, LE01CEvidence.BuildWorkflow };
            foreach (var action in actions)
            {
                var step = new Step { name = action.Method.DeclaringType.Name + "." + action.Method.Name, status = "PASS" };
                var timer = System.Diagnostics.Stopwatch.StartNew();
                try { action(); }
                catch (Exception error) { step.status = "FAIL"; step.error = error.ToString(); report.status = "FAIL"; Debug.LogException(error); }
                timer.Stop(); step.milliseconds = timer.Elapsed.TotalMilliseconds; report.steps.Add(step);
            }
            Directory.CreateDirectory(Path.Combine(LE01CEditorTests.Root, "reports"));
            File.WriteAllText(Path.Combine(LE01CEditorTests.Root, "reports/integration.json"), JsonUtility.ToJson(report, true));
            if (report.status != "PASS") throw new InvalidOperationException("LE01C integration failed; inspect reports/integration.json");
            Debug.Log("LE01C_INTEGRATION_COMPLETE");
        }
        public static void ReopenAndMeasure()
        {
            LE01CEvidence.ReopenWorkflow();
            LE01CPerformance.Run();
        }
    }
}
