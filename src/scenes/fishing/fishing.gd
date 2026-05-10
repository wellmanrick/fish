extends Node3D
## Slice 1 fishing scene.
## Owns the world (water plane, bank, sun, sky), the first-person camera,
## and the debug HUD. All cast/reel logic lives in rod.gd — this script
## just wires input and displays state. Keep it boring.

@export_range(0.0005, 0.01, 0.0005) var mouse_sensitivity: float = 0.0025
@export_range(-1.4, 0.0, 0.05) var camera_pitch_min: float = -0.6
@export_range(0.0, 1.4, 0.05) var camera_pitch_max: float = 0.4

@onready var _player: Node3D = $Player
@onready var _camera: Camera3D = $Player/Camera3D
@onready var _rod: Rod = $Player/Camera3D/Rod
@onready var _debug_label: Label = $DebugUI/Panel/DebugLabel
@onready var _cast_power_bar: ProgressBar = $DebugUI/CastPowerBar

var _yaw: float = 0.0
var _pitch: float = 0.0


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_rod.lure_landed.connect(_on_lure_landed)
	_rod.lure_launched.connect(_on_lure_launched)
	_rod.lure_reeled_in.connect(_on_lure_reeled_in)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_yaw -= event.relative.x * mouse_sensitivity
		_pitch -= event.relative.y * mouse_sensitivity
		_pitch = clampf(_pitch, camera_pitch_min, camera_pitch_max)
		_player.rotation.y = _yaw
		_camera.rotation.x = _pitch
	elif event.is_action_pressed("toggle_mouse"):
		_toggle_mouse_capture()


func _process(_delta: float) -> void:
	_debug_label.text = _build_debug_text()
	_cast_power_bar.value = _rod.charge
	_cast_power_bar.visible = _rod.state == Rod.State.CHARGING


# --- signal handlers ------------------------------------------------------

func _on_lure_launched(power: float) -> void:
	print("[fishing] lure_launched power=%.2f" % power)


func _on_lure_landed(world_pos: Vector3) -> void:
	print("[fishing] lure_landed at %s" % world_pos)


func _on_lure_reeled_in() -> void:
	print("[fishing] lure_reeled_in")


# --- helpers --------------------------------------------------------------

func _toggle_mouse_capture() -> void:
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	else:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _build_debug_text() -> String:
	var lines: PackedStringArray = []
	lines.append("Cast state:    %s" % _rod.get_state_label())
	lines.append("Cast power:    %.2f" % _rod.charge)
	lines.append("Lure distance: %.1f m" % _rod.get_lure_distance())
	lines.append("Reel state:    %s" % _rod.get_reel_label())
	return "\n".join(lines)
