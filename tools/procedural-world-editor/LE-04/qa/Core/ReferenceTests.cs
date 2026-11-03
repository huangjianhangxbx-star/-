using System;
using System.Collections.Generic;
using System.Linq;
using XingHai.LE01.Core;
public static partial class Program {
 static VoxelModuleAsset ReferenceFixture() {
  return new VoxelModuleAsset{assetId="asymmetric-neutral",sourceHash=new string('b',64),size=new[]{3,2,2},palette=new List<VoxelPaletteEntry>{new VoxelPaletteEntry{id="ochre",role="solid",rgba=new[]{.6f,.3f,.1f,1f}},new VoxelPaletteEntry{id="white-label-ignored",role="snow",rgba=new[]{1f,1f,1f,1f}}},voxels=new List<VoxelCell>{new VoxelCell{x=0,y=0,z=0},new VoxelCell{x=1,y=0,z=0},new VoxelCell{x=2,y=0,z=0},new VoxelCell{x=0,y=0,z=1},new VoxelCell{x=0,y=1,z=0,material=1,faces=new[]{0,0,0,1,0,0}}}};
 }
 static ReferenceBrushCommand RefLine(int n) {var c=new ReferenceBrushCommand{Quantum=4,Seed=719};for(int i=0;i<n;i++)c.Path.Add(new TerrainPoint3(-.25f+i*.5f/(n-1),2,0));return c;}
 static void ReferenceTests() {
  var asset=ReferenceFixture();var settings=new ReferenceCompileSettings();
  var compiled=TerrainReferenceField.Compile(asset,settings);
  Need(!compiled.Rejected,"reference certified: "+compiled.Reason);
  var cached=TerrainReferenceField.Compile(asset,settings);
  Need(object.ReferenceEquals(compiled.Field,cached.Field)&&compiled.Field.SampleCount==5,"compile once cache exact occupancy");
  var a=TerrainReferenceEdits.Apply(EditFixture(),RefLine(10),compiled.Field);
  var b=TerrainReferenceEdits.Apply(EditFixture(),RefLine(2000),compiled.Field);
  Need(!a.Rejected&&!b.Rejected,"reference lines accepted: "+a.Reason+" / "+b.Reason);
  Need(VolumeHash(a.Snapshot)==VolumeHash(b.Snapshot),"polyline density invariant");
  var repeated=TerrainReferenceEdits.Apply(a.Snapshot,RefLine(200),compiled.Field);
  Need(!repeated.Rejected&&!repeated.Changed&&VolumeHash(a.Snapshot)==VolumeHash(repeated.Snapshot),"repeat sweep idempotent");
  Need(a.Snapshot.State.OwnedColumns.Count>0,"reference output effective volume");
  var lower=TerrainLocalEdits.Apply(a.Snapshot,new TerrainEditCommand{Mode=TerrainEditMode.Lower,Bounds=new Bounds2(0,0,4,4),Amount=4});
  Need(!lower.Rejected&&lower.Snapshot.ColumnAt(0,0).Last().Max==a.Snapshot.ColumnAt(0,0).Last().Max-4,"reference then ordinary lower reads final source");
  var sub=RefLine(10);sub.Mode=ReferenceBrushMode.Subtract;
  var cut=TerrainReferenceEdits.Apply(a.Snapshot,sub,compiled.Field);
  Need(!cut.Rejected&&cut.Snapshot.State.Palette.Count==a.Snapshot.State.Palette.Count,"subtract adds no colors");
  var stretched=RefLine(2);stretched.ScaleX=2;var stretch=TerrainReferenceEdits.Apply(EditFixture(),stretched,compiled.Field);
  Need(!stretch.Rejected&&stretch.Dirty.Bounds.MaxX>a.Dirty.Bounds.MaxX,"stretch resamples footprint");
  var noColor=RefLine(2);noColor.UseColor=false;var plain=TerrainReferenceEdits.Apply(EditFixture(),noColor,compiled.Field);
  Need(!plain.Rejected&&plain.Snapshot.State.Palette.Count==EditFixture().State.Palette.Count,"reference color toggle");
  var invalid=asset.Copy();invalid.voxels.Add(invalid.voxels[0].Copy());Need(TerrainReferenceField.Compile(invalid,settings).Rejected,"duplicate invalid source rejected");
  var huge=RefLine(2);huge.ScaleX=3;huge.ScaleY=3;huge.ScaleZ=3;huge.Quantum=1;huge.Path[1]=new TerrainPoint3(40,2,0);
  Need(TerrainReferenceEdits.Apply(EditFixture(),huge,compiled.Field).Rejected,"expanded fine work budget checked");
  Need(asset.voxels.Count==5&&asset.palette[1].role=="snow","source unchanged and labels retained without meaning");
  var manualSource=EditFixture();var manualState=manualSource.State.Copy();
  foreach(var k in manualSource.Columns())manualState.PaintRuns.Add(new TerrainPaintRun{X=k.X,Z=k.Z,YMin=-4096,YMax=4096,FaceMask=63,ColorId=7,Priority=100});manualSource=manualSource.WithState(manualState);
  var colorOnly=new ReferenceBrushCommand{Mode=ReferenceBrushMode.ColorOnly,Path=new List<TerrainPoint3>{new TerrainPoint3(0,1.75f,0)}};
  var protectedColor=TerrainReferenceEdits.Apply(manualSource,colorOnly,compiled.Field);
  Need(!protectedColor.Rejected&&!protectedColor.Changed&&protectedColor.Snapshot.State.PaintRuns.Count==manualState.PaintRuns.Count,"color reference respects manual painting without appending hidden ineffective runs");
  var emptySpot=new ReferenceBrushCommand{Path=new List<TerrainPoint3>{new TerrainPoint3(0,2,0)}};
  var hollow=TerrainReferenceEdits.Apply(EditFixture(),emptySpot,compiled.Field);
  Need(!hollow.Rejected&&hollow.Snapshot.ColumnAt(4,4).Last().Max==32,"reference blank is not bbox-filled or carved");
  colorOnly.Mode=ReferenceBrushMode.Add;colorOnly.OverwriteManual=true;
  var overwrite=TerrainReferenceEdits.Apply(manualSource,colorOnly,compiled.Field);
  Need(!overwrite.Rejected&&overwrite.Snapshot.ColorAt(0,28,0,3)!=7,"explicit reference overwrite can recolor existing manually-painted overlap");
  Console.WriteLine("reference: compile cache/shape/color/sweep/idempotence/resample/budgets/effective chain passed");
 }
}


