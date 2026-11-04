using System;
namespace XingHai.BridgeReplica
{
    [Serializable] public sealed class CurvePlacement
    {
        public string role,sourceId,sourceHash,edge,usage;
        public float startArc,endArc,lateral,baseY,yaw;
        public bool rigid;
        public int firstVertex,vertexCount,firstTriangle,triangleCount;
    }
    [Serializable] public sealed class CurveMapping
    {
        public int schemaVersion=2;
        public string kind="freehand-bridge-source-map",kitId,kitVersion,kitFingerprint;
        public bool researchOnly;
        public RouteDocument route;
        public CurvePlacement[] placements;
        public ReplicaBinding[] sources;
        public string generatedCore="recipe:swept-stone-core-v2; actual offset edges; quantized soffit; collider uses rendered mesh";
        public string adaptation="v2 structural templates may sweep along centre or independent edge arc; posts, arch stones and caps remain rigid. Raw source attributes archived separately; compatible shading is not the original shader.";
    }
}
