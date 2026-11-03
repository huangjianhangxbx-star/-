using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01
{
    [DisallowMultipleComponent]
    public sealed class LE04TerrainState : MonoBehaviour
    {
        [HideInInspector,TextArea] public string EditJson;
        [HideInInspector,TextArea] public string BrushJson;
        public TerrainEditState Read() { return string.IsNullOrEmpty(EditJson) ? new TerrainEditState() : JsonUtility.FromJson<TerrainEditState>(EditJson); }
        public void Write(TerrainEditState state) { EditJson=JsonUtility.ToJson(state); }
    }
}
