using System;

namespace XingHai.BridgeReplica
{
    public static class CurveExamples
    {
        static RouteDocument Empty(string id){return new RouteDocument{SchemaVersion=2,Id=id,Width=2,KitId="workshop.bridge.A",KitVersion="1"};}
        static void Add(RouteDocument d,float x,float y,float z){d.Nodes.Add(new RouteNode{Id="n"+d.Nodes.Count,X=x,Y=y,Z=z});}
        static void Arc(RouteDocument d,float x,float z,float startDegrees,float endDegrees,int steps)
        {for(int i=1;i<=steps;i++){double angle=(startDegrees+(endDegrees-startDegrees)*i/steps)*Math.PI/180;Add(d,x+6*(float)Math.Cos(angle),2,z+6*(float)Math.Sin(angle));}}
        public static RouteDocument Diagonal()
        {
            var d=Empty("curve.diagonal");float dx=12.3f,dz=7.1f,len=(float)Math.Sqrt(dx*dx+dz*dz);dx/=len;dz/=len;
            Add(d,0,0,0);Add(d,dx*4,2,dz*4);Add(d,dx*(len-4),2,dz*(len-4));Add(d,dx*len,0,dz*len);return d;
        }
        public static RouteDocument U()
        {
            var d=Empty("curve.U-radius6");Add(d,-4,0,0);Add(d,0,2,0);Add(d,8,2,0);Arc(d,8,6,-90,90,24);Add(d,0,2,12);Add(d,-4,0,12);
            d.Openings.Add(new RouteOpening{SegmentId=RouteDocument.GetSegmentId("n1","n2"),Width=4,Height=1.25f});return d;
        }
        public static RouteDocument S()
        {
            var d=Empty("curve.S-radius6");Add(d,-4,0,0);Add(d,0,2,0);Add(d,8,2,0);Arc(d,8,6,-90,0,12);Arc(d,20,6,180,90,12);Add(d,28,2,12);Add(d,32,0,12);return d;
        }
        public static RouteDocument C()
        {var d=Empty("curve.C-radius6");Add(d,6,2,0);Arc(d,0,0,0,150,20);return d;}
    }
}
