using System;
using UnityEngine;

namespace XingHai.SB03
{
    [DisallowMultipleComponent]
    public sealed class SB03BridgeAuthor : MonoBehaviour
    {
        [HideInInspector] public BridgeSpec Spec = new BridgeSpec();
        [HideInInspector, TextArea] public string SourceMapJson;
        [HideInInspector] public string KitVersion = "sb03.bridge/v1";
        [HideInInspector] public int Revision;
    }

    [Serializable] public sealed class SB03SourceMap
    {
        public string kitId, kitVersion;
        public BridgeSpec spec;
        public BridgePart[] parts;
        public BridgeSolid[] generatedCore;
        public SB03SourceRecord[] sources;
    }
    [Serializable] public sealed class SB03SourceRecord
    {
        public string id, title, fbx, fbxSha256, sourceSha256;
        public int number;
    }
}
