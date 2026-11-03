using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Unity.Collections;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using XingHai.LE01.Core;

namespace XingHai.LE01.Editor
{
    /// <summary>One-time, strict import of closed grid-aligned static meshes.
    /// Reads the actual source; it never rebuilds a recipe or edits an importer.</summary>
    public static class LE03MeshVoxelImport
    {
        const int MaxEnvelope=2000000,MaxTriangles=1000000,MaxPalette=256;
        const float GridTolerance=.0001f;
        struct FaceKey:IEquatable<FaceKey>
        {
            internal int axis,plane,u,v,sign;
            public bool Equals(FaceKey b){return axis==b.axis&&plane==b.plane&&u==b.u&&v==b.v&&sign==b.sign;}
            public override bool Equals(object b){return b is FaceKey&&Equals((FaceKey)b);}
            public override int GetHashCode(){unchecked{return axis*73856093^plane*19349663^u*83492791^v*397^sign;}}
        }
        struct EdgeKey:IEquatable<EdgeKey>
        {
            internal Vector3Int a,b;
            public bool Equals(EdgeKey other){return a==other.a&&b==other.b;}
            public override bool Equals(object other){return other is EdgeKey&&Equals((EdgeKey)other);}
            public override int GetHashCode(){unchecked{return a.GetHashCode()*397^b.GetHashCode();}}
        }
        struct EdgeUse {internal int count,direction;}
        sealed class SurfaceSample {internal Color color;internal string role;}
        sealed class MeshSolid
        {
            internal readonly HashSet<Vector3Int> cells=new HashSet<Vector3Int>();
            internal readonly Dictionary<FaceKey,SurfaceSample> surfaces=new Dictionary<FaceKey,SurfaceSample>();
            internal SurfaceSample interior;
        }
        sealed class MaterialData
        {
            internal int index;internal Color tint;internal string role;internal Texture2D texture;internal Vector2 scale,offset;
        }
        sealed class Context:IDisposable
        {
            internal readonly MemoryStream bytes=new MemoryStream();
            internal readonly BinaryWriter hash;
            internal readonly List<Texture2D> temporary=new List<Texture2D>();
            internal readonly Dictionary<Material,MaterialData> materials=new Dictionary<Material,MaterialData>();
            internal readonly Dictionary<Texture2D,Texture2D> textures=new Dictionary<Texture2D,Texture2D>();
            internal readonly Dictionary<Material,string> roles;
            internal Context(Dictionary<Material,string> roles){this.roles=roles;hash=new BinaryWriter(bytes);}
            public void Dispose(){foreach(var texture in temporary)UnityEngine.Object.DestroyImmediate(texture);hash.Dispose();bytes.Dispose();}
            internal Texture2D ReadTexture(Texture2D original)
            {
                Texture2D copy;if(textures.TryGetValue(original,out copy))return copy;
                if((long)original.width*original.height>4194304)throw new ArgumentException("Texture exceeds the bounded one-time import size.");
                if(original.isReadable)copy=original;
                else
                {
                    var previous=RenderTexture.active;bool previousSRGB=GL.sRGBWrite;
                    var target=RenderTexture.GetTemporary(original.width,original.height,0,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);
                    try {GL.sRGBWrite=QualitySettings.activeColorSpace==ColorSpace.Linear;Graphics.Blit(original,target);RenderTexture.active=target;copy=new Texture2D(original.width,original.height,TextureFormat.RGBA32,false,false);copy.ReadPixels(new Rect(0,0,original.width,original.height),0,0);copy.Apply(false,false);copy.filterMode=original.filterMode;copy.wrapModeU=original.wrapModeU;copy.wrapModeV=original.wrapModeV;temporary.Add(copy);}
                    finally {RenderTexture.active=previous;GL.sRGBWrite=previousSRGB;RenderTexture.ReleaseTemporary(target);}
                }
                textures.Add(original,copy);hash.Write(original.width);hash.Write(original.height);hash.Write((int)original.filterMode);hash.Write((int)original.wrapModeU);hash.Write((int)original.wrapModeV);
                foreach(var c in copy.GetPixels()){WriteColor(hash,c);}return copy;
            }
            internal MaterialData Material(Material material)
            {
                if(material==null)throw new ArgumentException("Every imported mesh face needs an explicit material.");MaterialData cached;if(materials.TryGetValue(material,out cached))return cached;
                if(material.shader==null)throw new ArgumentException("Missing source material shader.");
                if(material.renderQueue>=3000||material.HasProperty("_Surface")&&material.GetFloat("_Surface")>.5f||material.HasProperty("_Mode")&&material.GetFloat("_Mode")>.5f||material.HasProperty("_AlphaClip")&&material.GetFloat("_AlphaClip")>.5f)throw new ArgumentException("Transparent or cutout materials require an explicit opaque voxel source.");
                string colorProperty=material.HasProperty("_BaseColor")?"_BaseColor":material.HasProperty("_Color")?"_Color":null;
                string textureProperty=material.HasProperty("_BaseMap")&&material.GetTexture("_BaseMap")!=null?"_BaseMap":material.HasProperty("_MainTex")&&material.GetTexture("_MainTex")!=null?"_MainTex":null;
                if(colorProperty==null&&textureProperty==null)throw new ArgumentException("Unsupported shader: no explicit base color or map is available.");
                string role="solid";if(roles!=null&&roles.ContainsKey(material))role=roles[material];if(role!="rock"&&role!="snow"&&role!="solid")throw new ArgumentException("Material role must be rock, snow or solid.");
                cached=new MaterialData{index=materials.Count,tint=colorProperty==null?Color.white:material.GetColor(colorProperty),role=role,scale=Vector2.one};CheckColor(cached.tint);
                hash.Write(material.shader.name);hash.Write(colorProperty??"texture-only");WriteColor(hash,cached.tint);hash.Write(role);hash.Write(textureProperty??"");
                if(textureProperty!=null){var original=material.GetTexture(textureProperty) as Texture2D;if(original==null)throw new ArgumentException("Only static Texture2D base color maps are supported.");cached.texture=ReadTexture(original);cached.scale=material.GetTextureScale(textureProperty);cached.offset=material.GetTextureOffset(textureProperty);hash.Write(cached.scale.x);hash.Write(cached.scale.y);hash.Write(cached.offset.x);hash.Write(cached.offset.y);}
                materials.Add(material,cached);return cached;
            }
        }
        static void WriteColor(BinaryWriter writer,Color color){writer.Write(color.r);writer.Write(color.g);writer.Write(color.b);writer.Write(color.a);}
        static bool Finite(float value){return !float.IsNaN(value)&&!float.IsInfinity(value);}
        static void CheckColor(Color c){if(!Finite(c.r)||!Finite(c.g)||!Finite(c.b)||!Finite(c.a)||c.r<0||c.g<0||c.b<0||c.r>1||c.g>1||c.b>1||c.a<.999f)throw new ArgumentException("Only finite opaque base colors in the 0..1 range can be imported.");}
        static int Coordinate(Vector3Int p,int axis){return axis==0?p.x:axis==1?p.y:p.z;}
        static Vector3Int Point(int axis,int plane,int u,int v){return axis==0?new Vector3Int(plane,u,v):axis==1?new Vector3Int(v,plane,u):new Vector3Int(u,v,plane);}
        static int Compare(Vector3Int a,Vector3Int b){int c=a.x.CompareTo(b.x);if(c==0)c=a.y.CompareTo(b.y);if(c==0)c=a.z.CompareTo(b.z);return c;}
        static int Gcd(int a,int b){a=Math.Abs(a);b=Math.Abs(b);while(b!=0){int t=a%b;a=b;b=t;}return a;}
        static void Edge(Dictionary<EdgeKey,EdgeUse> edges,Vector3Int a,Vector3Int b)
        {
            var delta=b-a;int steps=Gcd(Gcd(delta.x,delta.y),delta.z);if(steps==0)throw new ArgumentException("Degenerate mesh edge.");var step=new Vector3Int(delta.x/steps,delta.y/steps,delta.z/steps);
            for(int n=0;n<steps;n++){var p=a+step*n;var q=p+step;bool forward=Compare(p,q)<0;var key=new EdgeKey{a=forward?p:q,b=forward?q:p};EdgeUse use;edges.TryGetValue(key,out use);use.count++;use.direction+=forward?1:-1;edges[key]=use;}
        }
        static Vector3Int Grid(Vector3 position,float q)
        {
            var p=position/q;if(!Finite(p.x)||!Finite(p.y)||!Finite(p.z)||Mathf.Abs(p.x)>8192||Mathf.Abs(p.y)>8192||Mathf.Abs(p.z)>8192)throw new ArgumentException("Mesh exceeds finite import coordinates.");var result=Vector3Int.RoundToInt(p);if(Mathf.Abs(p.x-result.x)>GridTolerance||Mathf.Abs(p.y-result.y)>GridTolerance||Mathf.Abs(p.z-result.z)>GridTolerance)throw new ArgumentException("Mesh vertices are off the requested voxel lattice; no automatic rescale is applied.");return result;
        }
        static bool Barycentric(Vector3Int a,Vector3Int b,Vector3Int c,int axis,float u,float v,out Vector3 weights)
        {
            int ua=(axis+1)%3,va=(axis+2)%3;float ax=Coordinate(a,ua),ay=Coordinate(a,va),bx=Coordinate(b,ua),by=Coordinate(b,va),cx=Coordinate(c,ua),cy=Coordinate(c,va);float denominator=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
            if(Mathf.Abs(denominator)<.00001f){weights=Vector3.zero;return false;}float first=((by-cy)*(u-cx)+(cx-bx)*(v-cy))/denominator,second=((cy-ay)*(u-cx)+(ax-cx)*(v-cy))/denominator;weights=new Vector3(first,second,1-first-second);return weights.x>=-.00001f&&weights.y>=-.00001f&&weights.z>=-.00001f;
        }
        static float Wrap(float uv,TextureWrapMode mode){if(mode==TextureWrapMode.Repeat)return Mathf.Repeat(uv,1);if(mode==TextureWrapMode.Mirror){float p=Mathf.Repeat(uv,2);return p<=1?p:2-p;}if(mode==TextureWrapMode.MirrorOnce)return Mathf.Clamp01(Mathf.Abs(uv));return Mathf.Clamp01(uv);}
        static Color SurfaceColor(MaterialData material,Vector2 uv,Color vertexColor)
        {
            Color texture=Color.white;if(material.texture!=null){uv=Vector2.Scale(uv,material.scale)+material.offset;uv.x=Wrap(uv.x,material.texture.wrapModeU);uv.y=Wrap(uv.y,material.texture.wrapModeV);texture=material.texture.filterMode==FilterMode.Point?material.texture.GetPixel(Mathf.Clamp(Mathf.FloorToInt(uv.x*material.texture.width),0,material.texture.width-1),Mathf.Clamp(Mathf.FloorToInt(uv.y*material.texture.height),0,material.texture.height-1)):material.texture.GetPixelBilinear(uv.x,uv.y);}
            Color color=material.tint*texture*vertexColor;CheckColor(color);return color;
        }
        static bool Same(SurfaceSample a,SurfaceSample b){return a.role==b.role&&Mathf.Abs(a.color.r-b.color.r)<.0001f&&Mathf.Abs(a.color.g-b.color.g)<.0001f&&Mathf.Abs(a.color.b-b.color.b)<.0001f&&Mathf.Abs(a.color.a-b.color.a)<.0001f;}
        static MeshSolid ReadSolid(Context context,MeshFilter filter,Transform root,float q)
        {
            var mesh=filter.sharedMesh;var renderer=filter.GetComponent<MeshRenderer>();if(mesh==null||renderer==null||!renderer.enabled)throw new ArgumentException("Every selected MeshFilter needs a visible static MeshRenderer.");if(filter.GetComponent<SkinnedMeshRenderer>()!=null||mesh.blendShapeCount>0)throw new ArgumentException("Animated/skinned meshes are not supported.");
            // Remove scene placement and heading, but preserve actual root scale
            // (including common FBX .01 conversion) as part of metre geometry.
            Matrix4x4 matrix=Matrix4x4.TRS(root.position,root.rotation,Vector3.one).inverse*filter.transform.localToWorldMatrix;bool mirrored=matrix.determinant<0;var solid=new MeshSolid();var edges=new Dictionary<EdgeKey,EdgeUse>();var allMaterials=renderer.sharedMaterials;if(allMaterials.Length<mesh.subMeshCount)throw new ArgumentException("Mesh has submeshes without explicit materials.");
            using(var read=MeshUtility.AcquireReadOnlyMeshData(mesh))
            {
                var data=read[0];int count=data.vertexCount;if(count<4||count>2000000)throw new ArgumentException("Invalid or oversized static mesh.");
                using(var positions=new NativeArray<Vector3>(count,Allocator.Temp))using(var texcoords=new NativeArray<Vector2>(count,Allocator.Temp))using(var colors=new NativeArray<Color>(count,Allocator.Temp))
                {
                    data.GetVertices(positions);bool hasUV=data.HasVertexAttribute(VertexAttribute.TexCoord0),hasColor=data.HasVertexAttribute(VertexAttribute.Color);if(hasUV)data.GetUVs(0,texcoords);if(hasColor)data.GetColors(colors);
                    var grid=new Vector3Int[count];for(int i=0;i<count;i++){Vector3 point=matrix.MultiplyPoint3x4(positions[i]);grid[i]=Grid(point,q);context.hash.Write(point.x);context.hash.Write(point.y);context.hash.Write(point.z);context.hash.Write(texcoords[i].x);context.hash.Write(texcoords[i].y);WriteColor(context.hash,hasColor?colors[i]:Color.white);}
                    int triangleCount=0;for(int sub=0;sub<data.subMeshCount;sub++)
                    {
                        var descriptor=data.GetSubMesh(sub);if(descriptor.topology!=MeshTopology.Triangles||descriptor.indexCount%3!=0)throw new ArgumentException("Only triangle submeshes are supported.");triangleCount+=descriptor.indexCount/3;if(triangleCount>MaxTriangles)throw new ArgumentException("Source mesh exceeds the bounded triangle count.");var material=context.Material(allMaterials[sub]);context.hash.Write(material.index);if(material.texture!=null&&!hasUV)throw new ArgumentException("Textured source has no UV0; color cannot be guessed.");if(solid.interior==null)solid.interior=new SurfaceSample{color=material.tint,role=material.role};
                        using(var indices=new NativeArray<int>(descriptor.indexCount,Allocator.Temp))
                        {
                            data.GetIndices(indices,sub,true);for(int index=0;index<indices.Length;index+=3)
                            {
                                int i0=indices[index],i1=indices[index+(mirrored?2:1)],i2=indices[index+(mirrored?1:2)];context.hash.Write(i0);context.hash.Write(i1);context.hash.Write(i2);var a=grid[i0];var b=grid[i1];var c=grid[i2];Vector3 normal=Vector3.Cross((Vector3)(b-a),(Vector3)(c-a));int axis=Mathf.Abs(normal.x)>.0001f?0:Mathf.Abs(normal.y)>.0001f?1:2;if(normal.sqrMagnitude<.0001f||Mathf.Abs(normal[(axis+1)%3])>.0001f||Mathf.Abs(normal[(axis+2)%3])>.0001f)throw new ArgumentException("Source contains slanted or degenerate faces; only voxel-aligned orthogonal surfaces are accepted.");Edge(edges,a,b);Edge(edges,b,c);Edge(edges,c,a);
                                int ua=(axis+1)%3,va=(axis+2)%3,plane=Coordinate(a,axis),sign=normal[axis]>0?1:-1;int minU=Math.Min(Coordinate(a,ua),Math.Min(Coordinate(b,ua),Coordinate(c,ua))),maxU=Math.Max(Coordinate(a,ua),Math.Max(Coordinate(b,ua),Coordinate(c,ua))),minV=Math.Min(Coordinate(a,va),Math.Min(Coordinate(b,va),Coordinate(c,va))),maxV=Math.Max(Coordinate(a,va),Math.Max(Coordinate(b,va),Coordinate(c,va)));
                                if((long)(maxU-minU)*(maxV-minV)>MaxEnvelope)throw new ArgumentException("Source surface exceeds the bounded import area.");
                                for(int u=minU;u<maxU;u++)for(int v=minV;v<maxV;v++)
                                {
                                    Vector3 w;if(!Barycentric(a,b,c,axis,u+.5f,v+.5f,out w))continue;Vector2 uv=texcoords[i0]*w.x+texcoords[i1]*w.y+texcoords[i2]*w.z;Color color=hasColor?colors[i0]*w.x+colors[i1]*w.y+colors[i2]*w.z:Color.white;var sample=new SurfaceSample{color=SurfaceColor(material,uv,color),role=material.role};var key=new FaceKey{axis=axis,plane=plane,u=u,v=v,sign=sign};SurfaceSample old;if(solid.surfaces.TryGetValue(key,out old)&&!Same(old,sample))throw new ArgumentException("Conflicting source colors meet at one voxel face center; choose a finer grid or explicit source face color.");solid.surfaces[key]=sample;
                                }
                            }
                        }
                    }
                }
            }
            if(edges.Count==0||edges.Values.Any(e=>e.count!=2||e.direction!=0))throw new ArgumentException("Each static mesh must be a closed, consistently wound surface.");
            // Exact positive-X parity per YZ column. Bounds only limit the work;
            // disconnected regions, concavities and actual holes remain empty.
            foreach(var column in solid.surfaces.Where(p=>p.Key.axis==0).GroupBy(p=>new Vector2Int(p.Key.u,p.Key.v)))
            {
                var cuts=column.Select(p=>p.Key.plane).Distinct().OrderBy(x=>x).ToArray();if(cuts.Length%2!=0)throw new ArgumentException("Closed source has ambiguous odd occupancy crossings.");for(int n=0;n<cuts.Length;n+=2)for(int x=cuts[n];x<cuts[n+1];x++){solid.cells.Add(new Vector3Int(x,column.Key.x,column.Key.y));if(solid.cells.Count>MaxEnvelope)throw new ArgumentException("Source occupancy exceeds bounded one-time import size.");}
            }
            if(solid.cells.Count==0)throw new ArgumentException("Source has no closed voxel volume.");return solid;
        }
        static int Palette(List<VoxelPaletteEntry> palette,SurfaceSample sample)
        {
            for(int i=0;i<palette.Count;i++){var p=palette[i];if(p.role==sample.role&&Mathf.Abs(p.rgba[0]-sample.color.r)<.0001f&&Mathf.Abs(p.rgba[1]-sample.color.g)<.0001f&&Mathf.Abs(p.rgba[2]-sample.color.b)<.0001f&&Mathf.Abs(p.rgba[3]-sample.color.a)<.0001f)return i;}
            if(palette.Count>=MaxPalette)throw new ArgumentException("Imported face colors exceed the 256-entry palette; prepare an explicit voxel palette.");int id=palette.Count;palette.Add(new VoxelPaletteEntry{id=sample.role+".surface."+id,role=sample.role,rgba=new[]{sample.color.r,sample.color.g,sample.color.b,sample.color.a}});return id;
        }
        public static VoxelModuleAsset Import(GameObject source,float voxelSize,string assetId,Dictionary<Material,string> roles=null)
        {
            if(source==null||!Finite(voxelSize)||voxelSize<=0||voxelSize>16||string.IsNullOrWhiteSpace(assetId))throw new ArgumentException("Select a static source, positive voxel size and stable asset ID.");if(source.GetComponentsInChildren<SkinnedMeshRenderer>(true).Length>0)throw new ArgumentException("Skinned/animated source is not supported by this static importer.");
            var filters=source.GetComponentsInChildren<MeshFilter>(false);if(filters.Length==0)throw new ArgumentException("Source has no active static mesh.");
            using(var context=new Context(roles))
            {
                context.hash.Write("LE03.actual-mesh-import.v1");context.hash.Write(voxelSize);var solids=filters.Select(f=>ReadSolid(context,f,source.transform,voxelSize)).ToArray();var owners=new Dictionary<Vector3Int,List<MeshSolid>>();foreach(var solid in solids)foreach(var cell in solid.cells){List<MeshSolid> list;if(!owners.TryGetValue(cell,out list))owners[cell]=list=new List<MeshSolid>();list.Add(solid);if(owners.Count>MaxEnvelope)throw new ArgumentException("Combined source exceeds bounded import size.");}
                var min=new Vector3Int(owners.Keys.Min(p=>p.x),owners.Keys.Min(p=>p.y),owners.Keys.Min(p=>p.z));var max=new Vector3Int(owners.Keys.Max(p=>p.x)+1,owners.Keys.Max(p=>p.y)+1,owners.Keys.Max(p=>p.z)+1);var size=max-min;if((long)size.x*size.y*size.z>MaxEnvelope)throw new ArgumentException("Sparse source envelope exceeds bounded import size.");
                var asset=new VoxelModuleAsset{schemaVersion=1,assetId=assetId,assetVersion=1,voxelSize=voxelSize,origin=new[]{min.x*voxelSize,min.y*voxelSize,min.z*voxelSize},size=new[]{size.x,size.y,size.z},pivot=new[]{(float)-min.x,(float)-min.y,(float)-min.z},palette=new List<VoxelPaletteEntry>(),voxels=new List<VoxelCell>()};
                foreach(var pair in owners.OrderBy(p=>p.Key.x).ThenBy(p=>p.Key.y).ThenBy(p=>p.Key.z))
                {
                    var point=pair.Key;int material=Palette(asset.palette,pair.Value[0].interior);var faces=Enumerable.Repeat(material,6).ToArray();for(int direction=0;direction<6;direction++)
                    {
                        int axis=direction/2,sign=direction%2==0?-1:1;var offset=axis==0?new Vector3Int(sign,0,0):axis==1?new Vector3Int(0,sign,0):new Vector3Int(0,0,sign);if(owners.ContainsKey(point+offset))continue;
                        var key=new FaceKey{axis=axis,plane=Coordinate(point,axis)+(sign>0?1:0),u=Coordinate(point,(axis+1)%3),v=Coordinate(point,(axis+2)%3),sign=sign};SurfaceSample chosen=null;foreach(var solid in pair.Value){SurfaceSample candidate;if(!solid.surfaces.TryGetValue(key,out candidate))continue;if(chosen!=null&&!Same(chosen,candidate))throw new ArgumentException("Overlapping source solids assign conflicting colors to one exposed face.");chosen=candidate;}if(chosen==null)throw new ArgumentException("Source winding does not provide an outward color for an exposed voxel face.");faces[direction]=Palette(asset.palette,chosen);
                    }
                    asset.voxels.Add(new VoxelCell{x=point.x-min.x,y=point.y-min.y,z=point.z-min.z,material=material,faces=faces});
                }
                context.hash.Flush();using(var sha=SHA256.Create())asset.sourceHash=BitConverter.ToString(sha.ComputeHash(context.bytes.ToArray())).Replace("-","").ToLowerInvariant();string error;if(!VoxelModules.ValidateAsset(asset,out error))throw new ArgumentException("Imported voxel asset failed validation: "+error);return asset;
            }
        }
    }
}
