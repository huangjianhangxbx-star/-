using System;
using System.Collections.Generic;
using System.Linq;

namespace XingHai.LE01.Core
{
    // An immutable footprint receipt. It is valid only for its exact input path,
    // so callers cannot accidentally reuse coverage after editing a public command.
    public sealed class TerrainCoverageSnapshot
    {
        readonly BrushMode mode;
        readonly float radius;
        readonly int quantum;
        readonly Point2[] path;
        internal readonly CellKey[] Keys;
        internal TerrainCoverageSnapshot(TerrainCommand command, CellKey[] keys)
        {
            mode = command.Mode; radius = command.Radius; quantum = command.Quantum;
            path = command.Path.ToArray(); Keys = keys;
        }
        internal bool PrefixMatches(TerrainCommand command)
        {
            if (command == null || command.Mode != mode || command.Radius != radius || command.Quantum != quantum || command.Path == null || command.Path.Count < path.Length) return false;
            for (int i = 0; i < path.Length; i++) if (command.Path[i].X != path[i].X || command.Path[i].Z != path[i].Z) return false;
            return true;
        }
        internal int Points { get { return path.Length; } }
        public bool Matches(TerrainCommand command) { return PrefixMatches(command) && command.Path.Count == path.Length; }
    }

    // One accumulator belongs to one frozen stroke and is prepared on its worker.
    // New segments are sampled once; every preview still applies their complete union
    // to the original author snapshot, never to the previous preview result.
    public sealed class TerrainStrokeCoverage
    {
        readonly object sync = new object();
        readonly HashSet<CellKey> tiles = new HashSet<CellKey>();
        TerrainCoverageSnapshot previous;
        CellKey[] keys;
        bool keysChanged;
        public TerrainCoverageSnapshot Prepare(TerrainCommand command)
        {
            lock (sync)
            {
                try
                {
                    Validate(command);
                    if (previous != null && previous.Matches(command)) return previous;
                    int first;
                    if (previous != null && previous.PrefixMatches(command)) first = previous.Points;
                    else { tiles.Clear(); keys = null; keysChanged = true; Disc(command, command.Path[0]); first = 1; }
                    for (int i = first; i < command.Path.Count; i++) Segment(command, command.Path[i - 1], command.Path[i]);
                    if (keys == null || keysChanged) { keys = tiles.ToArray(); keysChanged = false; }
                    previous = new TerrainCoverageSnapshot(command, keys);
                    return previous;
                }
                catch
                {
                    // A partly sampled invalid request must not poison the next request.
                    previous = null; keys = null; tiles.Clear(); keysChanged = false;
                    throw;
                }
            }
        }
        static bool Finite(float value) { return !float.IsNaN(value) && !float.IsInfinity(value); }
        static void Validate(TerrainCommand command)
        {
            if (command == null || command.Mode != BrushMode.Extend && command.Mode != BrushMode.Erase) throw new ArgumentException("Incremental coverage is for continuous extend and erase strokes.");
            if (command.Path == null || command.Path.Count == 0 || command.Path.Count > 8192 || !Finite(command.Radius) || command.Radius <= 0 || command.Radius > 32 || !TerrainUnits.ValidQuantum(command.Quantum)) throw new ArgumentException("Invalid continuous brush path or radius.");
            foreach (var point in command.Path) if (!Finite(point.X) || !Finite(point.Z) || Math.Abs(point.X) > 256 || Math.Abs(point.Z) > 256) throw new ArgumentException("Brush point outside supported finite work area.");
        }
        void Disc(TerrainCommand command, Point2 point)
        {
            int q = command.Quantum;
            int x0 = TerrainUnits.FloorDiv((int)Math.Floor((point.X - command.Radius) / TerrainUnits.Unit), q) * q;
            int z0 = TerrainUnits.FloorDiv((int)Math.Floor((point.Z - command.Radius) / TerrainUnits.Unit), q) * q;
            int x1 = (int)Math.Ceiling((point.X + command.Radius) / TerrainUnits.Unit), z1 = (int)Math.Ceiling((point.Z + command.Radius) / TerrainUnits.Unit);
            for (int z = z0; z < z1; z += q) for (int x = x0; x < x1; x += q)
            {
                float dx = (x + q * .5f) * TerrainUnits.Unit - point.X, dz = (z + q * .5f) * TerrainUnits.Unit - point.Z;
                if (dx * dx + dz * dz <= command.Radius * command.Radius && tiles.Add(new CellKey(x, z, q))) keysChanged = true;
            }
            if (tiles.Count > TerrainKernel.MaxAuthorLeaves) throw new ArgumentException("Brush area exceeds leaf budget.");
        }
        void Segment(TerrainCommand command, Point2 a, Point2 b)
        {
            float size = command.Quantum * TerrainUnits.Unit;
            double length = Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Z - a.Z) * (b.Z - a.Z));
            double count = Math.Ceiling(length / Math.Min(command.Radius * .4f, size * .5f));
            if (double.IsNaN(count) || double.IsInfinity(count) || count > 16384) throw new ArgumentException("Brush segment exceeds work budget.");
            int steps = (int)count;
            for (int n = 1; n <= steps; n++) Disc(command, new Point2(a.X + (b.X - a.X) * n / steps, a.Z + (b.Z - a.Z) * n / steps));
        }
    }
}
