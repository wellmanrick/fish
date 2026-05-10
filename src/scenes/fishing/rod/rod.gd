extends Node3D
class_name Rod
## First-person fishing rod. Owns the cast state machine, the active lure,
## and the rod's placeholder visual pose. Designed to be parented to a
## Camera3D so it inherits look direction automatically.
##
## State machine: IDLE → CHARGING → IN_FLIGHT → IN_WATER → REELING → IDLE
##
## Slice 1 only knows about distance to rod tip — no fish, no tension.
## Tension and depth land in later prompts; this script keeps the same
## state names so they can hook in without renaming.

signal lure_launched(power: float)            ## power is 0.0..1.0
signal lure_landed(world_pos: Vector3)        ## emitted on water impact
signal lure_reeled_in()                       ## emitted when lure returns to rod tip

enum State { IDLE, CHARGING, IN_FLIGHT, IN_WATER, REELING }

@export_group("Cast tuning")
@export_range(0.5, 4.0, 0.1) var charge_rate: float = 1.6        ## charge units per second
@export_range(4.0, 30.0, 0.5) var min_launch_force: float = 12.0 ## m/s at charge=0
@export_range(15.0, 60.0, 0.5) var max_launch_force: float = 32.0 ## m/s at charge=1
@export_range(0.0, 1.2, 0.05) var launch_pitch_offset: float = 0.35 ## radians up from camera forward

@export_group("Reel tuning")
@export_range(1.0, 20.0, 0.5) var reel_speed: float = 6.0        ## m/s lure approach during reel
@export_range(0.1, 2.0, 0.05) var reel_finish_distance: float = 0.5 ## snap-to-finish radius

@export_group("References")
@export var lure_scene: PackedScene

var charge: float = 0.0
var state: State = State.IDLE

@onready var _camera: Camera3D = get_parent() as Camera3D
@onready var _rod_mesh: MeshInstance3D = $RodMesh
@onready var _lure_spawn: Marker3D = $LureSpawnPoint
@onready var _rod_tip: Marker3D = $Tip

var _current_lure: Lure = null


func _ready() -> void:
	if _camera == null:
		push_warning("Rod expects to be a child of a Camera3D — visual aim may be wrong.")
	if lure_scene == null:
		push_error("Rod has no lure_scene assigned — casting will fail.")


func _process(delta: float) -> void:
	match state:
		State.IDLE:
			_idle_pose(delta)
			if Input.is_action_just_pressed("cast"):
				_begin_charge()

		State.CHARGING:
			charge = minf(1.0, charge + charge_rate * delta)
			_charging_pose(delta)
			if Input.is_action_just_pressed("cancel_cast"):
				_cancel_charge()
			elif Input.is_action_just_released("cast"):
				_release_cast()

		State.IN_FLIGHT:
			_idle_pose(delta)

		State.IN_WATER:
			_idle_pose(delta)
			if Input.is_action_just_pressed("cast"):
				_begin_reel()

		State.REELING:
			_idle_pose(delta)
			_reel_step(delta)
			if Input.is_action_just_released("cast"):
				_stop_reel()


# --- state transitions ----------------------------------------------------

func _begin_charge() -> void:
	state = State.CHARGING
	charge = 0.0


func _cancel_charge() -> void:
	state = State.IDLE
	charge = 0.0


func _release_cast() -> void:
	if lure_scene == null or _camera == null:
		state = State.IDLE
		charge = 0.0
		return

	var lure: Lure = lure_scene.instantiate()
	get_tree().current_scene.add_child(lure)
	lure.global_transform = _lure_spawn.global_transform

	# Launch direction = camera forward, tilted up by launch_pitch_offset.
	var fwd: Vector3 = -_camera.global_transform.basis.z
	var right: Vector3 = _camera.global_transform.basis.x
	var launch_dir: Vector3 = fwd.rotated(right, launch_pitch_offset).normalized()
	var force: float = lerpf(min_launch_force, max_launch_force, charge)

	lure.launch(launch_dir * force)
	lure.landed.connect(_on_lure_landed_internal)

	_current_lure = lure
	state = State.IN_FLIGHT
	lure_launched.emit(charge)
	charge = 0.0


func _on_lure_landed_internal(world_pos: Vector3) -> void:
	state = State.IN_WATER
	lure_landed.emit(world_pos)


func _begin_reel() -> void:
	state = State.REELING


func _stop_reel() -> void:
	state = State.IN_WATER


func _finish_reel() -> void:
	if is_instance_valid(_current_lure):
		_current_lure.queue_free()
	_current_lure = null
	state = State.IDLE
	lure_reeled_in.emit()


func _reel_step(delta: float) -> void:
	if not is_instance_valid(_current_lure):
		_finish_reel()
		return
	var to_tip: Vector3 = _rod_tip.global_position - _current_lure.global_position
	var step: float = reel_speed * delta
	if to_tip.length() <= step + reel_finish_distance:
		_finish_reel()
		return
	_current_lure.global_position += to_tip.normalized() * step


# --- placeholder rod animation -------------------------------------------
#
# Just tilts the rod mesh on its X axis. Real animation arrives with the
# real rod model (later prompt). These exist so the cast feels responsive
# even with primitives.

func _idle_pose(delta: float) -> void:
	_rod_mesh.rotation.x = lerpf(_rod_mesh.rotation.x, 0.0, 8.0 * delta)


func _charging_pose(delta: float) -> void:
	var target: float = lerpf(0.0, -0.55, charge)
	_rod_mesh.rotation.x = lerpf(_rod_mesh.rotation.x, target, 12.0 * delta)


# --- debug helpers consumed by fishing.gd --------------------------------

func get_state_label() -> String:
	return State.keys()[state]


func get_reel_label() -> String:
	return "REELING" if state == State.REELING else "IDLE"


func get_lure_distance() -> float:
	if not is_instance_valid(_current_lure) or _camera == null:
		return 0.0
	return _current_lure.global_position.distance_to(_camera.global_position)
