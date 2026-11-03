using System;
using System.Linq;

namespace XingHai.LE01.Core
{
    public static class TerrainSlopeEdits
    {
        static bool Finite(float value){return !float.IsNaN(value)&&!float.IsInfinity(value);}
        public static TerrainResult Apply(TerrainDocument source,TerrainCommand command)
        {
            var result=new TerrainResult{Document=source==null?new TerrainDocument():source.Copy()};
            try
            {
                string error;if(!TerrainKernel.Validate(source,out error))throw new ArgumentException(error);
                if(source.GeneratorVersion!="le01.3")throw new ArgumentException("Create an explicit v3 terrain candidate before using gradual height brushes.");
                if(command==null||command.Path==null||command.Path.Count==0||command.Path.Count>8192||!TerrainUnits.ValidQuantum(command.Quantum)||!Finite(command.Radius)||command.Radius<0||!Finite(command.Falloff)||command.Falloff<0||command.Radius+command.Falloff<=0||command.Radius+command.Falloff>32||!Finite(command.Strength)||Math.Abs(command.Strength)>8)throw new ArgumentException("Invalid height brush radius, transition, or strength.");
                if(command.Mode!=BrushMode.SmoothRaise&&command.Mode!=BrushMode.SmoothLower)throw new ArgumentException("Choose a gradual height operation.");
                if(!Enum.IsDefined(typeof(TerrainHeightForm),command.HeightForm)||!Finite(command.RotationDegrees)||!Finite(command.AspectRatio)||command.AspectRatio<1||command.AspectRatio>4||(command.Radius+command.Falloff)*(command.HeightForm==TerrainHeightForm.RoundTerrace?1:command.AspectRatio)>32)throw new ArgumentException("Invalid height form, direction, or aspect.");
                if(command.HeightForm!=TerrainHeightForm.RoundTerrace&&source.RockRuleVersion!=1)throw new ArgumentException("Adopt structure rules before using directional height forms.");
                var p=command.Path[0];if(!Finite(p.X)||!Finite(p.Z)||Math.Abs(p.X)>256||Math.Abs(p.Z)>256)throw new ArgumentException("Invalid brush centre.");
                float outer=command.Radius+command.Falloff;int pad=TerrainUnits.ToUnits(outer*(command.HeightForm==TerrainHeightForm.RoundTerrace?1:command.AspectRatio))+4;
                int px=TerrainUnits.ToUnits(p.X),pz=TerrainUnits.ToUnits(p.Z);
                result.DirtyBounds=new Bounds2(px-pad,pz-pad,px+pad+1,pz+pad+1);
                if(command.Strength==0){result.Message="No change";return result;}
                var doc=result.Document;var index=new CellIndex(doc.Cells);
                foreach(var old in doc.Cells.ToArray())
                {
                    if(!result.DirtyBounds.Intersects(new Bounds2(old.X,old.Z,old.X+old.Size,old.Z+old.Size)))continue;
                    int q=Math.Min(old.Size,command.Quantum);index.Split(old,q);
                    for(int z=old.Z;z<old.Z+old.Size;z+=q)for(int x=old.X;x<old.X+old.Size;x+=q)
                    {
                        var cell=index.At(x,z);float dx=(x+q*.5f)*TerrainUnits.Unit-p.X,dz=(z+q*.5f)*TerrainUnits.Unit-p.Z;
                        double weight=TerrainHeightProfiles.Weight(command.HeightForm,dx,dz,command.Radius,command.Falloff,command.RotationDegrees,command.AspectRatio);if(weight<=0)continue;
                        int delta=(int)Math.Round(Math.Abs(command.Strength)*weight/TerrainUnits.Unit/q,MidpointRounding.AwayFromZero)*q;
                        if(command.Mode==BrushMode.SmoothLower)delta=-delta;
                        int next=Math.Max(doc.BaseHeight+q,cell.Top+delta);if(Math.Abs((long)next)>4096)throw new ArgumentException("Height brush exceeds the supported work height.");
                        cell.Top=next;cell.PlaneId="p"+next;
                    }
                }
                doc.Cells=index.Map.Values.OrderBy(c=>c.X).ThenBy(c=>c.Z).ThenBy(c=>c.Size).ToList();doc.ActiveQuantum=command.Quantum;doc.BrushRadius=Math.Max(.0625f,command.Radius);
                if(!TerrainKernel.Validate(doc,out error))throw new ArgumentException(error);
                result.Changed=TerrainQueries.ContentHash(source)!=TerrainQueries.ContentHash(doc);
                TerrainSculptEdits.CheckAuthorEdit(source,result,command);result.Message=result.Rejected?result.Message:result.Changed?"Gradual height candidate ready":"No change";
            }
            catch(ArgumentException error){result.Document=source==null?new TerrainDocument():source.Copy();result.Rejected=true;result.Changed=false;result.Message=error.Message;}
            return result;
        }
    }
}
