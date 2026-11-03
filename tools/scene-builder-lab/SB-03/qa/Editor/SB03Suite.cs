namespace XingHai.SB03.QA
{
    public static class SB03Suite
    {
        public static void Visual(){SB03Evidence.Run();SB03KitTests.Run();}
        public static void Final(){SB03EditorTests.Run();SB03KitTests.Run();SB03Evidence.Persistence();SB03Evidence.Run();SB03Evidence.Measure();SB03SceneInputTests.Run();}
        public static void Reopen(){SB03Evidence.Reopen();SB03Evidence.NativeReopen();}
        public static void Diagnostics(){SB03SceneInputTests.HeightProbe();SB03SceneInputTests.HeightProbeWithoutNativeTools();SB03Evidence.Persistence();SB03Evidence.Run();}
    }
}
