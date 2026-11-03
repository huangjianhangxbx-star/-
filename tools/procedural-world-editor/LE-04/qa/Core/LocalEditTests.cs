using System;
using System.Collections.Generic;
using System.Linq;
using XingHai.LE01.Core;
public static partial class Program {
 static TerrainEditSnapshot EditFixture() {
  var d=new TerrainDocument{Id="edit-fixture",BaseHeight=-16,GeneratorVersion="le01.1"};
  for(int z=-8;z<8;z+=4)for(int x=-8;x<8;x+=4)d.Cells.Add(new TerrainCell{X=x,Z=z,Size=4,Top=32,PlaneId="p0"});
  return TerrainEffectiveSource.Capture(d,new TerrainEditState(),null);
 }
 static string VolumeHash(TerrainEditSnapshot s){return string.Join(";",s.Columns().OrderBy(k=>k.X).ThenBy(k=>k.Z).Select(k=>k.X+","+k.Z+":"+string.Join("/",s.ColumnAt(k.X,k.Z).Select(v=>v.Min+","+v.Max+","+v.BaseColorId))));}
 static void LocalTests() {
  var source=EditFixture();
  var r=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Erase,Bounds=new Bounds2(0,0,2,2),YMin=8,YMax=16});
  Need(!r.Rejected,"middle band erase accepted with adjacent support: "+r.Reason);
  Need(r.Snapshot.ColumnAt(0,0).Count==2,"middle erase keeps both untouched bands");
  Need(r.Snapshot.ColumnAt(0,0)[0].Min==-16&&r.Snapshot.ColumnAt(0,0)[0].Max==8&&r.Snapshot.ColumnAt(0,0)[1].Min==16&&r.Snapshot.ColumnAt(0,0)[1].Max==32,"half-open band exact");
  Need(VolumeHash(source)==VolumeHash(EditFixture()),"source unchanged");
  var erased=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Erase,Bounds=new Bounds2(-8,-8,-7,-7),YMin=-4096,YMax=4096});
  Need(!erased.Rejected&&erased.Snapshot.ColumnAt(-8,-8).Count==0,"empty override tombstone");
  Need(erased.Snapshot.State.OwnedColumns.Any(c=>c.X==-8&&c.Z==-8&&c.Spans.Count==0),"empty override persisted");
  var raised=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Raise,Bounds=new Bounds2(0,0,2,2),Amount=8});
  Need(!raised.Rejected&&raised.Snapshot.ColumnAt(0,0).Last().Max==40,"raise effective source");
  var lowered=TerrainLocalEdits.Apply(raised.Snapshot,new TerrainEditCommand{Mode=TerrainEditMode.Lower,Bounds=new Bounds2(0,0,2,2),Amount=4});
  Need(!lowered.Rejected&&lowered.Snapshot.ColumnAt(0,0).Last().Max==36,"lower prior effective override");
  var thick=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Thicken,Bounds=new Bounds2(6,-4,12,4),YMin=8,YMax=24,Amount=4,Normal=new TerrainPoint3(1,0,0)});
  Need(!thick.Rejected&&thick.Snapshot.ColumnAt(9,0).Any(v=>v.Min==8&&v.Max==24),"middle side thickness projects existing wall band");
  var thin=TerrainLocalEdits.Apply(thick.Snapshot,new TerrainEditCommand{Mode=TerrainEditMode.Thin,Bounds=new Bounds2(6,-4,12,4),YMin=8,YMax=24,Amount=2,Quantum=2,Normal=new TerrainPoint3(1,0,0)});
  Need(!thin.Rejected&&thin.Snapshot.ColumnAt(11,0).Count==0&&thin.Snapshot.ColumnAt(8,0).Count>0,"thin outer shell preserves inner wall");
  var locked=EditFixture();locked.Basis.ShapeLocks.Add(new ShapeLock{Bounds=new Bounds2(0,0,4,4),MinHeight=0,MaxHeight=48});
  var lockResult=TerrainLocalEdits.Apply(locked,new TerrainEditCommand{Mode=TerrainEditMode.Erase,Bounds=new Bounds2(0,0,1,1),YMin=8,YMax=16});
  Need(lockResult.Rejected&&object.ReferenceEquals(lockResult.Snapshot,locked),"shape lock rejects atomically");
  var singleDoc=new TerrainDocument{Id="support",GeneratorVersion="le01.1",BaseHeight=0,Cells=new List<TerrainCell>{new TerrainCell{X=0,Z=0,Size=1,Top=48,PlaneId="p0"}}};
  var single=TerrainEffectiveSource.Capture(singleDoc,new TerrainEditState(),null);
  var support=TerrainLocalEdits.Apply(single,new TerrainEditCommand{Mode=TerrainEditMode.Erase,Bounds=new Bounds2(0,0,1,1),YMin=8,YMax=16});
  Need(support.Rejected,"sole support cut refuses floating remainder");
  var stale=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Raise,Bounds=new Bounds2(0,0,1,1),ExpectedRevision=500});
  Need(stale.Rejected,"stale expected revision rejected");
  var slope=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.SmoothRaise,Anchor=new TerrainPoint3(0,2,0),Radius=.45f,Amount=16});
  Need(!slope.Rejected&&slope.Snapshot.ColumnAt(0,0).Last().Max-source.ColumnAt(0,0).Last().Max>slope.Snapshot.ColumnAt(5,0).Last().Max-source.ColumnAt(5,0).Last().Max,"smooth mode defaults to a graduated shoulder");
  var bands=new TerrainEditState{OwnedColumns=new List<TerrainColumnOverride>{new TerrainColumnOverride{X=0,Z=0,Spans=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(0,16,0),new TerrainVolumeSpan(16,32,1),new TerrainVolumeSpan(32,48,0)}}}};
  var colored=TerrainEffectiveSource.Capture(singleDoc,bands,null);
  var coloredCut=TerrainLocalEdits.Apply(colored,new TerrainEditCommand{Mode=TerrainEditMode.Erase,Bounds=new Bounds2(0,0,1,1),YMin=8,YMax=16});
  Need(coloredCut.Rejected,"support connectivity crosses adjoining ordinary color intervals");
  var q4=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Raise,Bounds=new Bounds2(0,0,2,2),Amount=5,Quantum=4});
  var q2=TerrainLocalEdits.Apply(source,new TerrainEditCommand{Mode=TerrainEditMode.Raise,Bounds=new Bounds2(0,0,2,2),Amount=5,Quantum=2});
  Need(q4.Snapshot.ColumnAt(0,0).Last().Max!=q2.Snapshot.ColumnAt(0,0).Last().Max,"local target quantum controls added layer steps without resampling untouched cliff");
  Console.WriteLine("local: bands/tombstone/effective chain/thicken/thin/locks/support/stale passed");
 }
}




