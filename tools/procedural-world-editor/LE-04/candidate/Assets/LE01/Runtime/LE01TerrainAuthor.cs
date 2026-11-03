using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01
{
    [DisallowMultipleComponent]
    public sealed class LE01TerrainAuthor : MonoBehaviour
    {
        [HideInInspector, TextArea] public string DocumentJson;
        [HideInInspector] public bool Gray;
        public TerrainDocument Read()
        {
            return string.IsNullOrEmpty(DocumentJson) ? new TerrainDocument() : JsonUtility.FromJson<TerrainDocument>(DocumentJson);
        }
        public void Write(TerrainDocument document) { DocumentJson=JsonUtility.ToJson(document); }
    }
}
