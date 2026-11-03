using System;
using UnityEngine;
namespace XingHai.BridgeReplica
{
    [DisallowMultipleComponent] public sealed class ReplicaAuthor : MonoBehaviour
    {
        [HideInInspector,TextArea] public string DocumentJson;
        [HideInInspector,TextArea] public string MappingJson;
        [HideInInspector] public ReplicaKit Kit;
        public RouteDocument Read(){return string.IsNullOrEmpty(DocumentJson)?null:JsonUtility.FromJson<RouteDocument>(DocumentJson);}
        public void Write(RouteDocument value){DocumentJson=JsonUtility.ToJson(value);}
    }
    [Serializable] public sealed class ReplicaMapping
    {
        public string kitId,kitVersion,kitFingerprint;
        public RouteDocument route;
        public XingHai.SB03.BridgePart[] parts;
        public XingHai.SB03.BridgeSolid[] generatedCore;
        public ReplicaBinding[] sources;
    }
}
