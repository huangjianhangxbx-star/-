using System;
namespace XingHai.LE01.Core
{
 public static class TerrainHeightProfiles
 {
  static double Smooth(double t){t=Math.Max(0,Math.Min(1,t));return t*t*(3-2*t);}
  public static float Weight(TerrainHeightForm form,float dx,float dz,float radius,float falloff,float rotation,float aspect)
  {
   double outer=radius+falloff;if(outer<=0)return 0;
   if(form==TerrainHeightForm.RoundTerrace){double distance=Math.Sqrt(dx*dx+dz*dz);return distance>=outer?0:distance<=radius?1:(float)(1-Smooth((distance-radius)/falloff));}
   double angle=rotation*Math.PI/180,ca=Math.Cos(angle),sa=Math.Sin(angle),u=dx*ca+dz*sa,v=-dx*sa+dz*ca,longRadius=outer*aspect;
   double ellipse=Math.Sqrt(u*u/(longRadius*longRadius)+v*v/(outer*outer));if(ellipse>=1)return 0;
   double radial=1-Smooth(ellipse),value;
   if(form==TerrainHeightForm.Ridge)value=(1-Smooth(Math.Abs(u)/longRadius))*(1-Smooth(Math.Abs(v)/outer));
   else if(form==TerrainHeightForm.Slope)value=radial*(1-.7*u/longRadius);
   else value=radial*(1+.65*u/longRadius-.3*v/outer);
   return (float)Math.Max(0,Math.Min(1,value));
  }
 }
}
