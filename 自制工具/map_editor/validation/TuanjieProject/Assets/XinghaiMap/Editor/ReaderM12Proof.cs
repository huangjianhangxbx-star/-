using System;
using System.IO;
using System.Collections.Generic;
using Newtonsoft.Json;
using UnityEngine;
using UnityEditor;
namespace Xinghai.MapEditor.Editor {public static class ReaderM12Proof {
 static string Source(string surfaces,string extra="",string cells="{\"x\":0,\"y\":0,\"z\":0,\"color\":0}"){return "{\"version\":1,\"mapId\":\"m12-reader\",\"revision\":0,\"voxelSize\":0.25,\"cells\":["+cells+"],\"surfaces\":["+surfaces+"]"+extra+"}";}
 static string Face(int face,string tag,int z=-999){if(z==-999)z=face==4?1:0;return "{\"x\":"+(face==0?1:0)+",\"y\":"+(face==2?1:0)+",\"z\":"+z+",\"face\":"+face+",\"tag\":\""+tag+"\"}";}
 public static void Run(){var results=new List<object>();int failed=0;Action<string,Action> check=(name,action)=>{try{action();results.Add(new{name,passed=true});}catch(Exception e){failed++;results.Add(new{name,passed=false,error=e.Message});}};
 Action<string,string> reject=(name,json)=>check(name,()=>{try{SourceReader.Parse(json);}catch{return;}throw new Exception("Illegal source was accepted");});
 foreach(string tag in new[]{"walk","highground","deploy","ground"})foreach(int face in new[]{0,1,2,3,5})reject(tag+" side/bottom "+face,Source(Face(face,tag)));
 reject("floating top",Source(Face(4,"walk",2)));
 reject("internal top",Source(Face(4,"highground"),"","{\"x\":0,\"y\":0,\"z\":0,\"color\":0},{\"x\":0,\"y\":0,\"z\":1,\"color\":0}"));
 reject("floating obstacle",Source(Face(0,"obstacle",2)));
 reject("duplicate face",Source(Face(4,"walk")+","+Face(4,"highground")));
 foreach(string tag in new[]{"deploy","ground"})check("legacy "+tag+" normalized",()=>{if(SourceReader.Parse(Source(Face(4,tag))).surfaces[0].tag!="walk")throw new Exception("Legacy tag not normalized");});
 check("valid obstacle side",()=>SourceReader.Parse(Source(Face(0,"obstacle"))));
 check("valid top",()=>SourceReader.Parse(Source(Face(4,"walk"))));
 check("editor references excluded",()=>{var doc=SourceReader.Parse(Source(Face(4,"walk"),",\"editor\":{\"reference\":{\"assetId\":\"helper-only\"}}"));if(doc.instances.Length!=0||JsonConvert.SerializeObject(doc).Contains("helper-only"))throw new Exception("Editor reference leaked");});
 check("TypeScript editor six negative-coordinate faces",()=>{var doc=SourceReader.Parse(File.ReadAllText("../m12/ts-six-face-source.json"));if(doc.cells.Length!=1||doc.surfaces.Length!=6||doc.surfaces[4].tag!="highground")throw new Exception("TS source lost geometry or surface");});
 Directory.CreateDirectory("../m12");File.WriteAllText("../m12/reader-result.json",JsonConvert.SerializeObject(new{engine=Application.unityVersion,failed,results},Formatting.Indented));Debug.Log("M12_READER_FAILED="+failed);EditorApplication.Exit(failed==0?0:1);
 }
}}


