using System;
using System.Collections;
using System.IO;
using UnityEngine;
namespace Xinghai.MapEditor {
 public class ProofPlayer:MonoBehaviour {
  IEnumerator Start(){
   Application.runInBackground=true;
   if(Array.IndexOf(Environment.GetCommandLineArgs(),"--xh-proof")<0)yield break;
   yield return null;yield return new WaitForSeconds(1);
   var events=FindObjectsOfType<SampleEvent>();bool ok=events.Length==2;
   if(ok){int a=events[0].Count,b=events[1].Count;events[0].Activate();ok=events[0].Count==a+1&&events[1].Count==b&&events[0].Identity!=events[1].Identity;}
   var args=Environment.GetCommandLineArgs();int p=Array.IndexOf(args,"--report");
   if(p>=0&&p+1<args.Length){
    File.WriteAllText(args[p+1],"{\"runtimePassed\":"+(ok?"true":"false")+",\"version\":\""+Application.unityVersion+"\"}");
    var cam=FindObjectOfType<Camera>();var rt=new RenderTexture(1100,720,24);cam.targetTexture=rt;cam.Render();RenderTexture.active=rt;
    var image=new Texture2D(1100,720,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1100,720),0,0);image.Apply();File.WriteAllBytes(args[p+1]+".png",image.EncodeToPNG());
    cam.targetTexture=null;RenderTexture.active=null;rt.Release();Destroy(rt);Destroy(image);
   }
   yield return new WaitForSeconds(1);Application.Quit(ok?0:1);
  }
  void OnGUI(){GUI.Box(new Rect(16,16,380,145),"Xinghai map bake proof — two independent modules");var es=FindObjectsOfType<SampleEvent>();for(int i=0;i<es.Length;i++)if(GUI.Button(new Rect(30,50+i*45,340,36),"Module "+(i+1)+" event count: "+es[i].Count))es[i].Activate();}
 }
}
