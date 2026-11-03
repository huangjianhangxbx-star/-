namespace XingHai.BridgeReplica
{
    public static class RouteExamples
    {
        static RouteNode Node(string id,float x,float y,float z){return new RouteNode{Id=id,X=x,Y=y,Z=z};}
        public static RouteDocument Straight()
        {
            var d=new RouteDocument{Id="route.sample"};d.Nodes.Add(Node("start",0,0,0));d.Nodes.Add(Node("rise",4,2,0));d.Nodes.Add(Node("fall",10,2,0));d.Nodes.Add(Node("end",14,0,0));d.Openings.Add(new RouteOpening{SegmentId="rise__fall"});return d;
        }
        public static RouteDocument Detour()
        {
            var d=new RouteDocument{Id="route.sample"};d.Nodes.Add(Node("start",0,0,0));d.Nodes.Add(Node("rise",0,2,4));d.Nodes.Add(Node("turn-a",0,2,8));d.Nodes.Add(Node("turn-b",14,2,8));d.Nodes.Add(Node("fall",14,2,4));d.Nodes.Add(Node("end",14,0,0));d.Openings.Add(new RouteOpening{SegmentId="turn-a__turn-b"});return d;
        }
    }
}
