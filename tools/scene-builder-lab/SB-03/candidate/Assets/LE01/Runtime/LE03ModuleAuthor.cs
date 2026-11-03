using System.IO;
using System.Linq;
using UnityEngine;
using XingHai.LE01.Core;

namespace XingHai.LE01
{
    [DisallowMultipleComponent]
    public sealed class LE03ModuleAuthor : MonoBehaviour
    {
        [HideInInspector,TextArea] public string LayerJson;
        public VoxelLayerDocument Read(){return string.IsNullOrEmpty(LayerJson)?new VoxelLayerDocument():JsonUtility.FromJson<VoxelLayerDocument>(LayerJson);}
        public void Write(VoxelLayerDocument layer)
        {
            string error;if(!VoxelModules.ValidateLayer(layer,out error))throw new InvalidDataException(error);
            // JsonUtility serializes null arrays as empty arrays. The Core contract
            // distinguishes those: null means six uniform faces, [] is malformed.
            if(layer.assets.Any(a=>a.voxels.Any(v=>v.faces==null)))
            {layer=layer.Copy();foreach(var asset in layer.assets)foreach(var voxel in asset.voxels)if(voxel.faces==null)voxel.faces=Enumerable.Repeat(voxel.material,6).ToArray();}
            LayerJson=JsonUtility.ToJson(layer);
        }
    }
}
