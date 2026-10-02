using System;
using UnityEngine;
namespace Xinghai.MapEditor {
 [Serializable] public class AssetBinding {public string assetId;public GameObject prefab;public Texture2D texture;[Tooltip("本工具 Blender -Z forward / Y up FBX 配方需要180°轴向校正；团结原生Prefab不校正。其他来源FBX请取消并使用已对齐的Prefab。")]public bool blenderFbxAxes=true;}
 [CreateAssetMenu(menuName="星骸地图/资产映射表")]
 public class MapRegistry:ScriptableObject { public AssetBinding[] bindings=new AssetBinding[0]; }
}
