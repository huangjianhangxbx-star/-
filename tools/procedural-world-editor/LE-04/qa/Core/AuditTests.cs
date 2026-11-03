using System;
using System.Collections.Generic;
using XingHai.LE01.Core;
public static partial class Program {
 static void PaintAuditTests() {
  var empty=new TerrainDocument{Id="paint-visible-shelf",GeneratorVersion="le01.1",BaseHeight=0};
  var source=TerrainEffectiveSource.Capture(empty,new TerrainEditState());var state=source.State.Copy();
  state.OwnedColumns.Add(new TerrainColumnOverride{X=0,Z=0,Spans=new List<TerrainVolumeSpan>{new TerrainVolumeSpan(0,4),new TerrainVolumeSpan(8,12)}});source=source.WithState(state);
  var hit=new SurfaceHit(.03125f,.25f,.03125f,0,1,0);
  var c=new TerrainPaintCommand{Radius=.125f,YMin=0,YMax=16,Rgba=new[]{.8f,.2f,.3f,1f},Hits=new List<SurfaceHit>{hit},FaceMask=8,VisibleOnly=true};
  var r=TerrainPaintEdits.Apply(source,c);
  Need(!r.Rejected&&r.Changed&&r.Snapshot.ColorAt(0,3,0,3)!=source.ColorAt(0,3,0,3),"actual hit lower visible shelf must paint even if a disconnected overhang occupies the same XZ column");
  Need(r.Snapshot.ColorAt(0,11,0,3)==source.ColorAt(0,11,0,3),"painting an actual lower shelf must not paint the remote upper shelf");
 }
}
