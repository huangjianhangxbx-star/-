---
name: xinghai-voxel-workbench
description: Create and locally edit static block-style Blender assets using the XingHai workbench's shared profile, palette, recipes, and versioned presets. Use for this workbench's modeling tasks, not game logic or arbitrary Blender sculpting.
---

Tool root: `E:/WORLDCREATOR/XingHaiHuiLang/Origin/自制工具/voxel_workbench`.
Blender tested executable: `D:/steam/steamapps/common/Blender/blender.exe` (5.1.2).

Read `docs/API_CONTRACT.md` and `docs/AGENT_GUIDE.md` in the tool root before writing a recipe. Discover actual capabilities/profile through `addon.api` in Blender; don't invent color/template identifiers.

Use the shared API or `scripts/run_recipe.py`. JSON is finite modeling data, not executable Python. Preserve the caller's source file and write results in the caller-approved output directory. Background Blender does not update the user's currently open scene.

For local edits, open the actual input `.blend` with scripts disabled, inspect the asset, and use its current revision and stable instance IDs. Reusing a request ID with different contents is an error. Native edits are authoritative; don't reconstruct from an old recipe to erase them.

The initial profile uses 0.25m cells and bottom-center anchors. This is not a game tile size. Place operations use cell coordinates; exported models use meters. Query the profile rather than assuming these defaults are unchanged.

Presets are explicitly saved immutable versions in `Origin/tool_data/voxel_workbench`. Saving a preset is separate from scene undo. Don't register this skill globally or install the addon merely to run a modeling request.

Check actual meshes, neutral preview, and exported files. Read `docs/VALIDATION.md` for incomplete features before promising a supported workflow. Report an unsupported operation rather than bypassing the workbench with a separate geometry generator.
