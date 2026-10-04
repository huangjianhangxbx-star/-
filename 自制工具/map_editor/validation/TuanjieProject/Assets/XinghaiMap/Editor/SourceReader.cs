using System;
using System.IO;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace Xinghai.MapEditor.Editor {public static class SourceReader {
 static double Number(JToken o,string key,bool integer=false,double limit=8192){var t=o[key];if(t==null||(t.Type!=JTokenType.Integer&&t.Type!=JTokenType.Float))throw new Exception("缺少数值 "+key);double n=t.Value<double>();if(double.IsNaN(n)||double.IsInfinity(n)||Math.Abs(n)>limit||(integer&&n!=Math.Floor(n)))throw new Exception("数值无效 "+key);return n;}
 static JArray Array(JObject root,string key){if(root[key]==null)return new JArray();if(!(root[key] is JArray a))throw new Exception("数组无效 "+key);return a;}
 public static MapDocument Parse(string json){
  if(json.Length>64000000)throw new Exception("地图超过预算");JObject root;
  using(var reader=new JsonTextReader(new StringReader(json)){MaxDepth=32}){root=JObject.Load(reader,new JsonLoadSettings{DuplicatePropertyNameHandling=DuplicatePropertyNameHandling.Error});if(reader.Read())throw new Exception("地图包含多份JSON");}
  if(Number(root,"version",true)!=1||Number(root,"voxelSize")!=.25||Number(root,"revision",true,2147483647)<0||!Regex.IsMatch(root.Value<string>("mapId")??"","^[a-zA-Z0-9_-]{1,80}$"))throw new Exception("地图版本、身份或规格无效");
  var palette=root["palette"]==null?new MapDocument().palette:root["palette"].ToObject<string[]>();if(palette==null||palette.Length<1||palette.Length>64)throw new Exception("色板无效");foreach(var c in palette)if(!Regex.IsMatch(c??"","^#[0-9a-fA-F]{6}$"))throw new Exception("颜色无效");
  if(root["sideColor"]!=null&&root["sideColor"].Type!=JTokenType.Null){double side=Number(root,"sideColor",true);if(side<0||side>=palette.Length)throw new Exception("侧面颜色无效");}
  if(!(root["cells"] is JArray cells)||cells.Count>250000)throw new Exception("体素预算超限或无cells");var seen=new HashSet<string>();
  foreach(var c in cells){double x=Number(c,"x",true),y=Number(c,"y",true),z=Number(c,"z",true),color=Number(c,"color",true);if(color<0||color>=palette.Length||!seen.Add(x+","+y+","+z))throw new Exception("颜色无效或体素重复");string owner=c.Value<string>("owner");if(owner!=null&&owner!="height"&&owner!="volume")throw new Exception("几何来源无效");}
  seen.Clear();foreach(string kind in new[]{"instances","decals"}){var entries=Array(root,kind);if(entries.Count>10000)throw new Exception("实例超限");foreach(var p in entries){string id=p.Value<string>("id"),asset=p.Value<string>("assetId");if(string.IsNullOrWhiteSpace(id)||id.Length>80||string.IsNullOrWhiteSpace(asset)||asset.Length>80||p["scale"]!=null||!seen.Add(id))throw new Exception("实例身份无效或重复");foreach(string axis in new[]{"x","y","z"})Number(p,axis,false,2048);if(Number(p,"rotation",true,360000)%90!=0)throw new Exception("旋转必须轴对齐");if(kind=="decals"&&(Number(p,"width",false,256)<=0||Number(p,"height",false,256)<=0))throw new Exception("贴花尺寸无效");}}
  var occupied=new HashSet<string>();foreach(var c in cells)occupied.Add(c.Value<int>("x")+","+c.Value<int>("y")+","+c.Value<int>("z"));
  int[,] offsets={{-1,0,0},{0,0,0},{0,-1,0},{0,0,0},{0,0,-1},{0,0,0}};
  int[,] directions={{1,0,0},{-1,0,0},{0,1,0},{0,-1,0},{0,0,1},{0,0,-1}};
  seen.Clear();foreach(var s in Array(root,"surfaces")){
   foreach(var axis in new[]{"x","y","z"})Number(s,axis,true);int face=(int)Number(s,"face",true);string tag=s.Value<string>("tag");
   if(tag=="deploy"||tag=="ground"){tag="walk";s["tag"]=tag;}
   if(face<0||face>5||!new HashSet<string>{"walk","obstacle","highground"}.Contains(tag))throw new Exception("表面属性无效");
   int x=s.Value<int>("x"),y=s.Value<int>("y"),z=s.Value<int>("z");string key=x+","+y+","+z;
   if(!seen.Add(key+","+face))throw new Exception("表面属性重复："+key);
   if((tag=="walk"||tag=="highground")&&face!=4)throw new Exception("站立属性只允许水平向上顶面："+key);
   int cx=x+offsets[face,0],cy=y+offsets[face,1],cz=z+offsets[face,2];
   if(!occupied.Contains(cx+","+cy+","+cz)||occupied.Contains((cx+directions[face,0])+","+(cy+directions[face,1])+","+(cz+directions[face,2])))throw new Exception("表面属性缺少真实外露支撑："+key);
  }
  foreach(var p in Array(root,"instances")){if(p.Value<string>("kind")=="event"&&(string.IsNullOrWhiteSpace(p.Value<string>("registryKey"))||p.Value<string>("registryKey").Length>80))throw new Exception("事件缺少注册键");if(p["anchor"]!=null&&p["anchor"].Type!=JTokenType.Null){if(!(p["anchor"] is JArray a)||a.Count!=3)throw new Exception("锚点无效");foreach(var v in a){double n=v.Value<double>();if(double.IsNaN(n)||double.IsInfinity(n)||Math.Abs(n)>2048)throw new Exception("锚点无效");}}}
  foreach(var col in Array(root,"protectedColumns"))if(col.Type!=JTokenType.String||!Regex.IsMatch(col.Value<string>(),@"^-?\d+,-?\d+$"))throw new Exception("三维保护记录无效");var doc=root.ToObject<MapDocument>();doc.palette=palette;doc.instances=doc.instances??new Placement[0];doc.decals=doc.decals??new Decal[0];doc.surfaces=doc.surfaces??new Surface[0];return doc;
 }
}}
