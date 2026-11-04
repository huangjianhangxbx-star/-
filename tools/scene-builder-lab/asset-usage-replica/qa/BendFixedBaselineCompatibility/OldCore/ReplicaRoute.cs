using XingHai.SB03;
namespace XingHai.OldBridgeReplica
{
    // A versioned dispatch keeps old authors reproducible and gives all editor
    // consumers one authority for validation and derived geometry.
    public static class ReplicaRoute
    {
        public static RouteResult Solve(RouteDocument document)
        {
            if(document==null||document.SchemaVersion!=2)return RouteSolver.Solve(document);
            var curve=CurveSolver.Solve(document);
            return new RouteResult{Valid=curve.Valid,Message=curve.Message,Document=curve.Document,Curve=curve,
                Plan=new BridgePlan{Valid=curve.Valid,Spec=new BridgeSpec{Id=document.Id,Length=curve.Length,Width=document.Width,Rails=document.Rails}}};
        }
    }
}
