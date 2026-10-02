using UnityEngine;
namespace Xinghai.MapEditor {
 public class SampleEvent:MonoBehaviour {
  public string localId="switch";
  [SerializeField] int count;
  public string Identity=>gameObject.scene.path+"/"+GetComponentInParent<ModulePlacement>().placementId+"/"+localId;
  public int Count=>count;
  public void Activate(){count++;}
  void OnMouseDown(){Activate();}
 }
}
