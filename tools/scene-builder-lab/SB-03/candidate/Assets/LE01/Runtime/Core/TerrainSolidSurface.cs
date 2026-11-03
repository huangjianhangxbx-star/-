using System;
using System.Collections.Generic;
using System.Linq;
namespace XingHai.LE01.Core
{
 // A transient union of vertical solid intervals; not a second editable terrain source.
 internal sealed class TerrainSolidSurface
 {
  internal struct Span {public int Min,Max;public Span(int a,int b){Min=a;Max=b;}}
  internal readonly CellIndex Index;
  readonly Dictionary<CellKey,List<Span>> spans=new Dictionary<CellKey,List<Span>>();
  readonly int bottom;
  internal TerrainSolidSurface(IEnumerable<TerrainCell> cells,int baseHeight){Index=new CellIndex(cells);bottom=baseHeight;foreach(var c in cells)spans[new CellKey(c.X,c.Z,c.Size)]=new List<Span>{new Span(baseHeight,c.Top)};}
  internal List<Span> At(int x,int z){var c=Index.At(x,z);return c==null?new List<Span>():spans[new CellKey(c.X,c.Z,c.Size)];}
  internal List<Span> For(TerrainCell c){return spans[new CellKey(c.X,c.Z,c.Size)];}
  internal void SetSpans(TerrainCell c,List<Span> values){spans[new CellKey(c.X,c.Z,c.Size)]=values;}
  TerrainCell UnitCell(int x,int z,int top,bool create)
  {
   var c=Index.At(x,z);if(c==null){if(!create)return null;c=new TerrainCell{X=x,Z=z,Size=1,Top=top,PlaneId="wall-shape"};Index.Map[new CellKey(x,z,1)]=c;spans[new CellKey(x,z,1)]=new List<Span>();return c;}
   if(c.Size>1){var old=For(c);spans.Remove(new CellKey(c.X,c.Z,c.Size));Index.Split(c,1);for(int dz=c.Z;dz<c.Z+c.Size;dz++)for(int dx=c.X;dx<c.X+c.Size;dx++)spans[new CellKey(dx,dz,1)]=new List<Span>(old);c=Index.At(x,z);}
   c.Top=Math.Max(c.Top,top);return c;
  }
  internal void UnionAt(int x,int z,List<Span> addition,int upperHint=int.MinValue)
  {
   if(addition.Count==0)return;var c=UnitCell(x,z,Math.Max(upperHint,addition.Max(s=>s.Max)),true);var list=new List<Span>(For(c));list.AddRange(addition);list.Sort((a,b)=>a.Min.CompareTo(b.Min));var merged=new List<Span>();
   foreach(var span in list){if(merged.Count==0||merged[merged.Count-1].Max<span.Min)merged.Add(span);else {var previous=merged[merged.Count-1];previous.Max=Math.Max(previous.Max,span.Max);merged[merged.Count-1]=previous;}}SetSpans(c,merged);
  }
  internal void RemoveAt(int x,int z,List<Span> removal)
  {if(removal.Count==0)return;var c=UnitCell(x,z,bottom,false);if(c!=null)SetSpans(c,Visible(For(c),removal));}
  internal void Cut(TerrainCell c,int lo,int hi){if(lo<=bottom||hi>=c.Top||lo>=hi)return;spans[new CellKey(c.X,c.Z,c.Size)]=new List<Span>{new Span(bottom,lo),new Span(hi,c.Top)};}
  static bool Has(List<Span> list,int lo,int hi)
  {
   for(int i=0;i<list.Count;i++){var s=list[i];if(s.Min<=lo&&s.Max>=hi)return true;}
   return false;
  }
  static void SortDistinct(List<int> levels)
  {
   levels.Sort();int count=0;
   for(int i=0;i<levels.Count;i++)if(count==0||levels[i]!=levels[count-1])levels[count++]=levels[i];
   if(count<levels.Count)levels.RemoveRange(count,levels.Count-count);
  }
  void Fill(int x,int z,int lo,int hi)
  {
   var c=Index.At(x,z);if(c.Size>1){var old=For(c);spans.Remove(new CellKey(c.X,c.Z,c.Size));Index.Split(c,1);for(int dz=c.Z;dz<c.Z+c.Size;dz++)for(int dx=c.X;dx<c.X+c.Size;dx++)spans[new CellKey(dx,dz,1)]=new List<Span>(old);c=Index.At(x,z);}
   var list=For(c);list.Add(new Span(lo,hi));list.Sort((a,b)=>a.Min.CompareTo(b.Min));var merged=new List<Span>();foreach(var s in list){if(merged.Count==0||merged[merged.Count-1].Max<s.Min)merged.Add(s);else{var p=merged[merged.Count-1];p.Max=Math.Max(p.Max,s.Max);merged[merged.Count-1]=p;}}spans[new CellKey(c.X,c.Z,c.Size)]=merged;
  }
  internal void Regularize(CellIndex author,Bounds2 region,bool allowShapeBridges=false)
  {
   var pending=new Queue<CellKey>();var queued=new HashSet<CellKey>();Action<int,int> add=(x,z)=>{var k=new CellKey(x,z,0);if(region.Contains(x,z)&&queued.Add(k))pending.Enqueue(k);};
   foreach(var c in Index.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size)){add(c.X,c.Z);add(c.X+c.Size,c.Z);add(c.X,c.Z+c.Size);add(c.X+c.Size,c.Z+c.Size);}
   // These buffers are owned by one compile and retain the same sorted level and
   // queue order. Reusing them avoids allocating per corner and contact interval.
   var xs=new int[4];var zs=new int[4];var lists=new List<Span>[4];var occupied=new bool[4];
   var levels=new List<int>(16);var contactLevels=new List<int>(16);int[] aa={0,0,1,2},bb={1,2,3,3};
   while(pending.Count>0){var p=pending.Dequeue();queued.Remove(p);xs[0]=xs[2]=p.X-1;xs[1]=xs[3]=p.X;zs[0]=zs[1]=p.Z-1;zs[2]=zs[3]=p.Z;levels.Clear();for(int i=0;i<4;i++){lists[i]=At(xs[i],zs[i]);foreach(var s in lists[i]){levels.Add(s.Min);levels.Add(s.Max);}}
    SortDistinct(levels);for(int j=0;j<levels.Count-1;j++){int lo=levels[j],hi=levels[j+1];for(int i=0;i<4;i++)occupied[i]=Has(lists[i],lo,hi);int a=-1,b=-1;if(occupied[0]&&occupied[3]&&!occupied[1]&&!occupied[2]){a=1;b=2;}else if(occupied[1]&&occupied[2]&&!occupied[0]&&!occupied[3]){a=0;b=3;}if(a<0)continue;
     int chosen=-1;for(int candidate=0;candidate<2;candidate++){int i=candidate==0?a:b;var raw=author.At(xs[i],zs[i]);if(raw!=null&&raw.Top>=hi&&Index.At(xs[i],zs[i])!=null){chosen=i;break;}}
     if(chosen<0&&allowShapeBridges){for(int candidate=0;candidate<2;candidate++){int i=candidate==0?a:b;if(region.Contains(xs[i],zs[i])){int top=hi;for(int corner=0;corner<4;corner++){var cell=Index.At(xs[corner],zs[corner]);if(cell!=null)top=Math.Max(top,cell.Top);}UnitCell(xs[i],zs[i],top,true);chosen=i;break;}}}
     if(chosen<0)throw new ArgumentException("Diagonal-only terrain contact cannot produce a manifold surface.");
     int x=xs[chosen],z=zs[chosen];Fill(x,z,lo,hi);add(x,z);add(x+1,z);add(x,z+1);add(x+1,z+1);lists[chosen]=At(x,z);
    }
    for(int pair=0;pair<4;pair++){int a=aa[pair],b=bb[pair];if(FixHorizontalContact(xs[a],zs[a],xs[b],zs[b],author,contactLevels)){for(int i=0;i<4;i++){add(xs[i],zs[i]);add(xs[i]+1,zs[i]);add(xs[i],zs[i]+1);add(xs[i]+1,zs[i]+1);}}}
   }
  }
  bool FixHorizontalContact(int ax,int az,int bx,int bz,CellIndex author,List<int> levels)
  {
   if(Index.At(ax,az)==null||Index.At(bx,bz)==null)return false;
   var a=At(ax,az);var b=At(bx,bz);levels.Clear();foreach(var s in a){levels.Add(s.Min);levels.Add(s.Max);}foreach(var s in b){levels.Add(s.Min);levels.Add(s.Max);}SortDistinct(levels);
   foreach(int y in levels)
   {
    bool ad=Has(a,y-1,y),au=Has(a,y,y+1),bd=Has(b,y-1,y),bu=Has(b,y,y+1);
    if(ad&&!au&&!bd&&bu){if(author.At(ax,az).Top>y)Fill(ax,az,y,y+1);else Fill(bx,bz,y-1,y);return true;}
    if(!ad&&au&&bd&&!bu){Fill(ax,az,y-1,y);return true;}
   }
   return false;
  }
  internal static List<Span> Visible(List<Span> own,List<Span> neighbor)
  {
   var result=new List<Span>();foreach(var s in own){int start=s.Min;foreach(var n in neighbor){if(n.Max<=start)continue;if(n.Min>=s.Max)break;if(n.Min>start)result.Add(new Span(start,Math.Min(n.Min,s.Max)));start=Math.Max(start,n.Max);if(start>=s.Max)break;}if(start<s.Max)result.Add(new Span(start,s.Max));}return result;
  }
  internal static bool Same(List<Span> a,List<Span> b){if(a.Count!=b.Count)return false;for(int i=0;i<a.Count;i++)if(a[i].Min!=b[i].Min||a[i].Max!=b[i].Max)return false;return true;}
 }
}
