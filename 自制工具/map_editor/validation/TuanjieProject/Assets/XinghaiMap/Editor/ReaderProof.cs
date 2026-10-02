using System;
using System.IO;
using UnityEditor;
using UnityEngine;
namespace Xinghai.MapEditor.Editor {public static class ReaderProof {
 public static void Run(){try{
  string good=File.ReadAllText("Assets/Fixtures/platform.json");
  foreach(var bad in new[]{good.Replace("\"version\":1","\"version\":8"),good.Replace("\"x\":-1","\"x\":-1.5"),good.Replace("0.25","0.0"),good.Replace("\"color\":0","\"color\":99")}){bool rejected=false;try{SourceReader.Parse(bad);}catch{rejected=true;}if(!rejected)throw new Exception("Invalid source accepted: "+bad.Substring(0,Math.Min(100,bad.Length)));}
  if(SourceReader.Parse(good).cells.Length!=5)throw new Exception("Valid source lost cells");Debug.Log("XH_READER_PASS");EditorApplication.Exit(0);
 }catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}}
}}
