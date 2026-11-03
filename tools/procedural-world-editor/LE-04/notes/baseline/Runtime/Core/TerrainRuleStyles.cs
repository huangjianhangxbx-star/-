using System;
using System.Linq;
namespace XingHai.LE01.Core
{
 public static class TerrainRuleStyles
 {
  public static TerrainResult Adopt(TerrainDocument source)
  {
   var r=new TerrainResult{Document=source==null?new TerrainDocument():source.Copy()};string error;
   if(!TerrainKernel.Validate(source,out error)||source.GeneratorVersion!="le01.3"){r.Rejected=true;r.Message="Create a v3 candidate before adopting structure rules.";return r;}
   if(source.RockRuleVersion==1){r.Message="Structure rules are already active.";return r;}
   if(source.ShapeLocks.Any(l=>l.Enabled)||source.SculptOverrides.Any(e=>e.Enabled)){r.Rejected=true;r.Message="Keep this manually edited terrain. Adopt structure rules on an unedited copy so existing sculpt and protected shapes remain unchanged.";return r;}
   r.Document.Id=source.Id+".rules1";r.Document.SourceId="le03.hierarchical-rock";r.Document.SourceVersion=1;r.Document.RockRuleVersion=1;r.Document.HeightBrushForm=TerrainHeightForm.Mound;r.Document.HeightBrushAspect=1.7f;r.Document.Revision=0;r.Changed=true;r.Message="New structure-rule candidate; original source preserved.";return r;
  }
  public static TerrainResult Theme(TerrainDocument source,string id)
  {
   var r=new TerrainResult{Document=source==null?new TerrainDocument():source.Copy()};string error;
   if(!TerrainKernel.Validate(source,out error)||source.GeneratorVersion!="le01.3"||id!="stone"&&id!="snow-rock"){r.Rejected=true;r.Message="Choose a supported terrain theme.";return r;}
   string before=string.IsNullOrEmpty(source.TerrainThemeId)?"stone":source.TerrainThemeId;r.Document.TerrainThemeId=id;r.Changed=before!=id;r.Message=r.Changed?"Theme candidate ready":"No change";return r;
  }
 }
}
