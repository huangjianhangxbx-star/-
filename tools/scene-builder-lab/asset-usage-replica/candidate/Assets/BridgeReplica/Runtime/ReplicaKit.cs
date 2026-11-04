using System;
using UnityEngine;
namespace XingHai.BridgeReplica
{
    [Serializable] public sealed class ReplicaBinding
    {
        public string Role,Id,Title,ModelPath,PalettePath,NativeSource,ModelSha256,PaletteSha256,NativeSha256;
        public Vector3 Size;
        public float AdapterYaw=180;
        public Material Material;
        public Mesh Mesh;
        public string AttributeArchivePath,Usage;
    }
    public sealed class ReplicaKit : ScriptableObject
    {
        public string Id,Version,Family,ContentHash;
        public bool ResearchOnly;
        public ReplicaBinding[] Bindings;
    }
}
