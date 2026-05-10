# Bass Fishing

Stylized first-person arcade bass fishing game inspired by Sega Bass Fishing.
Built in **Godot 4**.

## Status

Vertical slice 1: cast → arc → splash → reel. No fish, no menus, no save —
intentionally. Each subsequent prompt adds one playable feature.

## Open the project

1. Install Godot 4.3 or later (https://godotengine.org).
2. Open Godot, click **Import**, select `project.godot` in this folder.
3. Press **F5** to run. Main scene is `res://src/scenes/fishing/fishing.tscn`.

## Controls (slice 1)

| Input | Action |
|---|---|
| Mouse move | Aim camera |
| Hold left mouse | Charge cast |
| Release left mouse | Launch lure |
| Right mouse | Cancel charge |
| Left mouse (lure in water) | Hold to reel in |
| `Esc` | Toggle mouse capture (for editor convenience) |

## Project layout

```
src/scenes/fishing/   First-person fishing scene + child scenes (rod, lure)
docs/validation/      One checklist per build prompt
assets/               Reserved for art/audio (empty until needed)
```

See `docs/validation/prompt_02_casting.md` for the slice 1 acceptance test.
