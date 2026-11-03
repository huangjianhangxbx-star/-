using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed class LE01StructureSelectionCache
    {
        LE01TerrainAuthor author;
        string json;
        TerrainStructureSnapshot snapshot;
        public TerrainStructureSnapshot Get(LE01TerrainAuthor current)
        {
            if(current==null)return null;
            if(snapshot==null||author!=current||json!=current.DocumentJson){var prepared=TerrainStructures.Prepare(current.Read());author=current;json=current.DocumentJson;snapshot=prepared;}
            else json=current.DocumentJson;
            return snapshot;
        }
    }
}
