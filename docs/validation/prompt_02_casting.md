# Validation Checklist — Prompt 2 (Casting Slice 1)

Goal: prove the cast loop works end-to-end before any other system gets built.

## 1. Open

- Open `project.godot` in Godot 4.3 or newer.
- Wait for first import to finish (`.godot/` folder will appear — that's expected).
- Confirm main scene = `res://src/scenes/fishing/fishing.tscn` (Project → Project Settings → Application → Run).

## 2. Inspect scene tree (in editor, before running)

Open `res://src/scenes/fishing/fishing.tscn`. Expect:

```
Fishing (Node3D)
├── WorldEnvironment
├── Sun (DirectionalLight3D)
├── WaterPlane (MeshInstance3D)
├── Bank (MeshInstance3D)
├── Player (Node3D)
│   └── Camera3D
│       └── Rod (instance of rod.tscn)
│           ├── RodMesh (MeshInstance3D)
│           ├── LureSpawnPoint (Marker3D)
│           └── Tip (Marker3D)
└── DebugUI (CanvasLayer)
    ├── Panel (PanelContainer)
    │   └── DebugLabel (Label)
    └── CastPowerBar (ProgressBar, hidden)
```

Open `rod.tscn` separately. Confirm `lure_scene` export points to `lure.tscn` (Inspector → References).

## 3. Run

Press **F5**. Expect:
- Window opens 1280×720 with mouse captured.
- Sky is light blue, ground is olive-green ahead, water is darker blue further out.
- A thin dark rod extends from lower-right of the view forward into the scene.
- Top-left HUD shows: `Cast state: IDLE / Cast power: 0.00 / Lure distance: 0.0 m / Reel state: IDLE`.

## 4. Interact

| Input | Expected response |
|---|---|
| Move mouse | Camera looks around. Pitch clamped (can't flip upside-down). |
| Hold left mouse | `Cast state` changes to `CHARGING`. Cast-power bar appears at the bottom and fills. Rod tilts back. |
| Release left mouse (mid-charge) | Lure spawns at rod tip and arcs forward. `Cast state` becomes `IN_FLIGHT`. Output prints `[fishing] lure_launched power=0.43`. |
| (Lure hits water) | Splash particles burst. `Cast state` becomes `IN_WATER`. Output prints `[fishing] lure_landed at (x, y, z)`. |
| Hold left mouse (lure in water) | `Cast state` becomes `REELING`. Lure visibly slides toward the rod tip. `Lure distance` ticks down. |
| Release left mouse mid-reel | `Cast state` returns to `IN_WATER`. Lure stops. |
| Continue holding until lure reaches tip | Lure disappears. Output prints `[fishing] lure_reeled_in`. State returns to `IDLE`. |
| Right mouse during charge | Charge cancels. State returns to `IDLE`, no lure spawned. |
| `Esc` | Mouse uncaptures (so you can use the editor). Press again to recapture. |

## 5. Debug values to watch

- `Remote → Fishing → Player/Camera3D/Rod` — `charge` climbs 0 → 1 while LMB is held.
- `Remote → Fishing → Player/Camera3D/Rod` — `state` cycles IDLE → CHARGING → IN_FLIGHT → IN_WATER → REELING → IDLE.
- Output panel: each transition prints a `[fishing] ...` line.

## 6. Errors that must NOT appear

- ❌ "Resource not found" / "Failed to load" — would mean a `res://` path is wrong.
- ❌ "Invalid get index 'state'" / "Cannot call method on null" — would mean a node path is wrong.
- ❌ "Rod has no lure_scene assigned" warning — means `rod.tscn` lost its export reference.
- ❌ Any GDScript parse error in the Output panel.
- ⚠️ Acceptable: a one-time "import" notice on first project open. Not acceptable on subsequent runs.

## 7. Visual proof to send back

Three screenshots:
1. Game running, idle (rod visible, HUD visible, no lure).
2. Mid-cast: cast-power bar visible, rod tilted back, charging.
3. Splash moment: lure on water, particles bursting.

## 8. Recommended commit (after the above passes)

Stage everything except `.godot/`:

```bash
git add -A
git commit -m "feat(slice-1): playable cast → arc → splash → reel [prompt 2]"
git tag prompt-02-casting   # optional checkpoint
```

## Known limitations of this slice (NOT bugs)

- No fish, no bites — that's prompt 4.
- No tension fight system — prompt 5.
- Reel just snaps the lure back along a straight line; no line slack, no underwater drift.
- Water is an opaque flat plane with no movement. Stylized water lands ~prompt 7.
- Rod is a brown box. Real rod model lands when a placeholder asset comes in (prompt 3+).
- No sound at all. Audio lands with the bite/fight slices.
- No menu, no pause. ESC just toggles mouse capture.
- Splash particles are a one-color burst. Replaced with a textured particle sheet later.

If anything in section 4 or 6 fails, screenshot the editor's Output panel and paste it back — I'll fix before we move on.
