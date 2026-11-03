using System;
using System.Linq;

namespace XingHai.LE01.Core
{
    public sealed class RockBrushPreset
    {
        public readonly string Id,Name,Description;
        public readonly int ColumnSpanUnits,BaseCutUnits,ReliefRangeUnits;
        public readonly float StepScale,ChildDensity,ChildReliefScale;
        internal RockBrushPreset(string id,string name,string description,int span,int cut,int relief,float step,float density,float child)
        {Id=id;Name=name;Description=description;ColumnSpanUnits=span;BaseCutUnits=cut;ReliefRangeUnits=relief;StepScale=step;ChildDensity=density;ChildReliefScale=child;}
    }
    public static class TerrainRockPresets
    {
        static readonly RockBrushPreset[] presets={
            new RockBrushPreset("classic","连贯柱崖","保留已认可的主柱、错台与次级棱槽。",20,2,8,1,.6f,1),
            new RockBrushPreset("broad","厚柱错台","较宽主柱、更明确的错台、较少细棱。",32,2,5,1.5f,.25f,.5f),
            new RockBrushPreset("fine","细棱岩壁","较细柱组、较密子棱与较浅错台。",12,1,6,.6f,1.1f,.75f)
        };
        public static RockBrushPreset[] All {get{return (RockBrushPreset[])presets.Clone();}}
        public static bool Known(string id){return string.IsNullOrEmpty(id)||presets.Any(p=>p.Id==id);}
        public static RockBrushPreset For(TerrainDocument document)
        {
            if(document==null||document.GeneratorVersion!="le01.3"||string.IsNullOrEmpty(document.RockPresetId))return presets[0];
            var found=presets.FirstOrDefault(p=>p.Id==document.RockPresetId);
            if(found==null)throw new ArgumentException("Unknown procedural rock preset.");return found;
        }
        public static TerrainResult Apply(TerrainDocument source,string id)
        {
            var result=new TerrainResult{Document=source==null?new TerrainDocument():source.Copy()};
            string error;
            if(source==null||!TerrainKernel.Validate(source,out error)||string.IsNullOrEmpty(id)||!Known(id)){result.Rejected=true;result.Message="Choose a valid procedural rock preset for a valid terrain document.";return result;}
            if(source.GeneratorVersion=="le01.3"&&For(source).Id==id){result.Message="This style is already active.";return result;}
            if(source.ShapeLocks!=null&&source.ShapeLocks.Any(l=>l.Enabled)||source.SculptOverrides!=null&&source.SculptOverrides.Any(o=>o.Enabled)){result.Rejected=true;result.ConflictCount=source.ShapeLocks==null?0:source.ShapeLocks.Count(l=>l.Enabled);result.Message="Restore manual sculpting and unlock the terrain before changing its structural style.";return result;}
            result.Document=TerrainGenerators.UpgradeToV3(source);result.Document.RockPresetId=id;result.Document.Revision=source.Revision+1;
            if(source.Cells.Count>0)result.DirtyBounds=new Bounds2(source.Cells.Min(c=>c.X),source.Cells.Min(c=>c.Z),source.Cells.Max(c=>c.X+c.Size),source.Cells.Max(c=>c.Z+c.Size));
            result.Changed=true;result.Message="Procedural style candidate ready.";return result;
        }
    }
}
