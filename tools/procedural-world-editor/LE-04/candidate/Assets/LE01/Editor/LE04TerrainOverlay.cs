using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public sealed partial class LE01Window
    {
        bool le04HasHit;Vector3 le04Point,le04Normal;
        void OnBasicScene(SceneView view)
        {
            var session=BasicSession;if(session==null||!session.Ready)return;var e=Event.current;
            int id=GUIUtility.GetControlID("LE04TerrainBrush".GetHashCode(),FocusType.Passive);
            if(e.type==EventType.KeyDown&&e.keyCode==KeyCode.Escape){session.Cancel();le04HasHit=false;GUIUtility.hotControl=0;e.Use();Repaint();return;}
            if(e.alt||EditorGUIUtility.editingTextField||(e.type==EventType.MouseDown&&e.button!=0)){session.Navigate();if(!session.Active)GUIUtility.hotControl=0;le04HasHit=false;return;}
            if(!enabledTool)return;if(e.type==EventType.Layout)HandleUtility.AddDefaultControl(id);
            if(e.type==EventType.MouseUp&&e.button==0&&session.Active&&!session.Anchor&&!session.Released){session.Release();GUIUtility.hotControl=0;e.Use();Repaint();return;}
            bool pointer=e.type==EventType.MouseMove||e.type==EventType.MouseDown||e.type==EventType.MouseDrag;
            if(pointer&&!session.Released)
            {
                var ray=HandleUtility.GUIPointToWorldRay(e.mousePosition);SurfaceHit hit;string message;
                le04HasHit=LE01Adapter.TryPickSurface(stroke.Author,ray,out hit,out message);
                if(le04HasHit){le04Point=new Vector3(hit.X,hit.Y,hit.Z);le04Normal=new Vector3(hit.NormalX,hit.NormalY,hit.NormalZ);}
                if(le04HasHit&&session.Active&&session.Settings.Tool=="reference")
                {
                    float distance;var plane=new Plane(Vector3.up,stroke.Author.transform.TransformPoint(session.AnchorPoint));
                    if(plane.Raycast(ray,out distance)){le04Point=stroke.Author.transform.InverseTransformPoint(ray.GetPoint(distance));le04Normal=session.AnchorNormal;}
                }
                if(!le04HasHit&&!LE01Adapter.LastSurfaceBlocked&&(session.Settings.Mode=="Extend"||session.Settings.Tool=="reference"))
                {
                    float height=session.Active?session.AnchorPoint.y:session.Settings.WorkPlane;float distance;
                    var plane=new Plane(Vector3.up,stroke.Author.transform.TransformPoint(new Vector3(0,height,0)));
                    if(plane.Raycast(ray,out distance)){le04Point=stroke.Author.transform.InverseTransformPoint(ray.GetPoint(distance));le04Normal=Vector3.up;le04HasHit=true;}
                }
                if(e.type==EventType.MouseDown&&e.button==0&&!session.Active&&!session.Busy)
                {
                    if(le04HasHit)
                    {
                        if(e.shift&&session.Settings.Tool=="paint")
                        {
                            TerrainSurfacePick picked;if(session.Build.PickIndex.TryPick(le04Point.x,le04Point.y,le04Point.z,Direction(le04Normal),out picked)&&picked.ColorId>=0&&picked.ColorId<session.Current.State.Palette.Count){var c=session.Current.State.Palette[picked.ColorId].rgba;session.Settings.Paint=new Color(c[0],c[1],c[2],1);}
                        }
                        else if(session.Settings.AnchorMode)session.BeginAnchor(le04Point,le04Normal);
                        else if(session.BeginStroke(le04Point,le04Normal))GUIUtility.hotControl=id;
                        e.Use();Repaint();
                    }
                    else session.Status=message;
                }
                else if(e.type==EventType.MouseDrag&&e.button==0&&session.Active&&!session.Anchor&&le04HasHit){session.Drag(le04Point,le04Normal);e.Use();}
                view.Repaint();
            }
            if(e.type==EventType.Repaint)
            {
                if(session.Active)DrawBasicSurfaceRange(session,session.AnchorPoint,session.AnchorNormal,true);
                else if(le04HasHit)DrawBasicSurfaceRange(session,le04Point,le04Normal,false);
                Handles.BeginGUI();GUI.Box(new Rect(10,10,390,58),GUIContent.none,EditorStyles.helpBox);GUI.Label(new Rect(18,15,374,18),"基础地貌 v2 · "+(session.Settings.AnchorMode?"锚点精修":"连续拖画"),EditorStyles.boldLabel);GUI.Label(new Rect(18,35,374,25),session.Status,EditorStyles.wordWrappedMiniLabel);Handles.EndGUI();
            }
        }
        static int Direction(Vector3 n){if(Mathf.Abs(n.x)>Mathf.Abs(n.y)&&Mathf.Abs(n.x)>Mathf.Abs(n.z))return n.x<0?0:1;if(Mathf.Abs(n.y)>Mathf.Abs(n.z))return n.y<0?2:3;return n.z<0?4:5;}
        public static void DrawBasicSurfaceRange(LE04TerrainSession session,Vector3 point,Vector3 normal,bool active)
        {
            if(session==null||session.Build==null)return;var s=session.Settings;var author=session.Author;bool anchor=active&&session.Anchor;
            if(s.Tool=="reference")
            {
                var references=session.Current.State.References;if(references.Count==0)return;var source=references[Mathf.Clamp(s.ReferenceIndex,0,references.Count-1)].Asset;var size=new Vector3(source.size[0],source.size[1],source.size[2])*source.voxelSize;var pivot=new Vector3(source.pivot[0],source.pivot[1],source.pivot[2])*source.voxelSize;
                var previousMatrix=Handles.matrix;var previousColor=Handles.color;var previousDepth=Handles.zTest;Handles.zTest=CompareFunction.LessEqual;Handles.color=new Color(.35f,.9f,1,.85f);
                Handles.matrix=author.transform.localToWorldMatrix*Matrix4x4.TRS(point,Quaternion.Euler(0,s.Yaw,0),new Vector3(s.ScaleX,s.ScaleY,s.ScaleZ));Handles.DrawWireCube(size*.5f-pivot,size);Handles.matrix=previousMatrix;
                Handles.Label(author.transform.TransformPoint(point),"参考采样外框 · 实际体积见候选预览");Handles.color=previousColor;Handles.zTest=previousDepth;return;
            }
            Vector3 min=new Vector3(point.x-(anchor?s.NegativeX:s.Radius),point.y-s.YBelow,point.z-(anchor?s.NegativeZ:s.Radius));
            Vector3 max=new Vector3(point.x+(anchor?s.PositiveX:s.Radius),point.y+s.YAbove,point.z+(anchor?s.PositiveZ:s.Radius));
            var previous=Handles.zTest;var oldColor=Handles.color;Handles.zTest=CompareFunction.LessEqual;
            Handles.color=active?new Color(.3f,1,.75f,.16f):new Color(.3f,.8f,1,.15f);int drawn=0;
            foreach(var chunk in session.Build.Chunks)
            {
                float chunkMinX=chunk.ChunkX*TerrainUnits.Chunk*TerrainUnits.Unit,chunkMinZ=chunk.ChunkZ*TerrainUnits.Chunk*TerrainUnits.Unit,chunkWidth=TerrainUnits.Chunk*TerrainUnits.Unit;
                if(chunkMinX>max.x||chunkMinX+chunkWidth<min.x||chunkMinZ>max.z||chunkMinZ+chunkWidth<min.z)continue;
                // Prepared quad surfaces are clipped to the actual edit volume. The overlay
                // therefore lies on mesh faces even where one greedy triangle spans a wall.
                for(int i=0;i+11<chunk.Vertices.Length&&drawn<512;i+=12)
                {
                    var faceNormal=new Vector3(chunk.Normals[i],chunk.Normals[i+1],chunk.Normals[i+2]);if(Vector3.Dot(faceNormal,normal)<.5f)continue;
                    var polygon=new List<Vector3>(4);for(int k=0;k<4;k++)polygon.Add(new Vector3(chunk.Vertices[i+k*3],chunk.Vertices[i+k*3+1],chunk.Vertices[i+k*3+2]));
                    polygon=Clip(polygon,0,min.x,true);polygon=Clip(polygon,0,max.x,false);polygon=Clip(polygon,1,min.y,true);polygon=Clip(polygon,1,max.y,false);polygon=Clip(polygon,2,min.z,true);polygon=Clip(polygon,2,max.z,false);
                    if(!anchor)for(int side=0;side<24&&polygon.Count>0;side++){float angle=side*Mathf.PI*2/24;var outward=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));polygon=ClipPlane(polygon,outward,Vector3.Dot(outward,point)+s.Radius*Mathf.Cos(Mathf.PI/24));}
                    if(polygon.Count<3)continue;var world=new Vector3[polygon.Count];for(int n=0;n<world.Length;n++)world[n]=author.transform.TransformPoint(polygon[n]+faceNormal*.008f);Handles.DrawAAConvexPolygon(world);drawn++;
                }
            }
            Handles.color=active?new Color(.3f,1,.75f,.9f):new Color(.4f,.85f,1,.9f);var center=author.transform.TransformPoint(point+normal*.012f);Handles.DrawWireDisc(center,author.transform.TransformDirection(normal),s.Radius);
            if(!anchor&&s.Tool=="shape"&&s.Falloff>0){Handles.color=new Color(Handles.color.r,Handles.color.g,Handles.color.b,.45f);Handles.DrawWireDisc(center,author.transform.TransformDirection(normal),s.Radius*(1-s.Falloff));}
            Handles.DotHandleCap(0,center,Quaternion.identity,HandleUtility.GetHandleSize(center)*.035f,EventType.Repaint);
            if(anchor){Handles.DrawWireCube(author.transform.TransformPoint((min+max)*.5f),max-min);Handles.Label(center,"固定锚点 · 实际表面高亮");}
            Handles.zTest=previous;Handles.color=oldColor;
        }
        static List<Vector3> Clip(List<Vector3> input,int axis,float bound,bool greater)
        {
            var output=new List<Vector3>();if(input.Count==0)return output;var a=input[input.Count-1];bool ai=greater?a[axis]>=bound:a[axis]<=bound;
            foreach(var b in input){bool bi=greater?b[axis]>=bound:b[axis]<=bound;if(ai!=bi){float t=(bound-a[axis])/(b[axis]-a[axis]);output.Add(Vector3.LerpUnclamped(a,b,t));}if(bi)output.Add(b);a=b;ai=bi;}return output;
        }
        static List<Vector3> ClipPlane(List<Vector3> input,Vector3 normal,float bound)
        {
            var output=new List<Vector3>();if(input.Count==0)return output;var a=input[input.Count-1];float da=Vector3.Dot(normal,a)-bound;
            foreach(var b in input){float db=Vector3.Dot(normal,b)-bound;if((da<=0)!=(db<=0))output.Add(Vector3.LerpUnclamped(a,b,da/(da-db)));if(db<=0)output.Add(b);a=b;da=db;}return output;
        }
    }
}
