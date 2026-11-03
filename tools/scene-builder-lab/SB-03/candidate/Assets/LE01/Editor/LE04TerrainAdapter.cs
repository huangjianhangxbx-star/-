using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    public static partial class LE01Adapter
    {
        // A-only prepared upload. In particular it never calls the legacy module composer.
        public static void UploadBasic(LE01TerrainAuthor author,TerrainSurfaceBuild build,bool clear=false)
        {
            var watch=System.Diagnostics.Stopwatch.StartNew();var root=Geometry(author);
            if(clear) foreach(Transform child in root.transform.Cast<Transform>().ToArray()) RemoveChunk(author,child.gameObject);
            var material=LE04TerrainFiles.MaterialFor(build.Palette,false);
            var changes=clear?build.Chunks:build.ChangedChunks;
            foreach(string id in build.EmptyChunkKeys){var old=root.transform.Find(id);if(old!=null)RemoveChunk(author,old.gameObject);}
            foreach(var data in changes)
            {
                var found=root.transform.Find(data.Id);if(data.Triangles.Length==0){if(found!=null)RemoveChunk(author,found.gameObject);continue;}
                var go=found==null?new GameObject(data.Id):found.gameObject;if(found==null)go.transform.SetParent(root.transform,false);ReactivateChunk(author,go);
                var filter=go.GetComponent<MeshFilter>();if(filter==null)filter=go.AddComponent<MeshFilter>();var oldMesh=filter.sharedMesh;
                var mesh=new Mesh{name=data.Id,indexFormat=IndexFormat.UInt32};int count=data.Vertices.Length/3;
                var vertices=new Vector3[count];var normals=new Vector3[count];var uv=new Vector2[count];
                for(int i=0;i<count;i++){vertices[i]=new Vector3(data.Vertices[3*i],data.Vertices[3*i+1],data.Vertices[3*i+2]);normals[i]=new Vector3(data.Normals[3*i],data.Normals[3*i+1],data.Normals[3*i+2]);uv[i]=new Vector2(data.UV[2*i],data.UV[2*i+1]);}
                mesh.vertices=vertices;mesh.normals=normals;mesh.uv=uv;mesh.triangles=data.Triangles;mesh.RecalculateBounds();filter.sharedMesh=mesh;
                var renderer=go.GetComponent<MeshRenderer>();if(renderer==null)renderer=go.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;
                var collider=go.GetComponent<MeshCollider>();if(collider==null)collider=go.AddComponent<MeshCollider>();collider.sharedMesh=mesh;
                RetireMesh(oldMesh);
            }
            // Stable UV slots mean palette growth changes just the shared material, not distant meshes.
            foreach(var renderer in root.GetComponentsInChildren<MeshRenderer>())renderer.sharedMaterial=material;
            InvalidateSurfaceMaps(author);GeometryChanged(author);watch.Stop();LastUploadMilliseconds=watch.ElapsedMilliseconds;
        }
    }
}
