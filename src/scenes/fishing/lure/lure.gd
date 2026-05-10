extends Node3D
class_name Lure
## Cast lure projectile. Custom kinematic physics — no RigidBody3D — so
## the arc is fully tunable for arcade feel. Detects water by checking
## when its Y dips below water_height.
##
## Slice 1 only flies and splashes. Retrieve speed and lure depth land
## in a later prompt; the same node will host them.

signal landed(world_pos: Vector3)

@export_range(5.0, 80.0, 0.5) var gravity: float = 28.0      ## exaggerated for arcade arc
@export_range(0.0, 0.5, 0.01) var drag: float = 0.05         ## per-second air drag
@export var water_height: float = 0.0                         ## Y of the water plane in this scene

var _velocity: Vector3 = Vector3.ZERO
var _airborne: bool = false

@onready var _splash: CPUParticles3D = $SplashParticles


func launch(initial_velocity: Vector3) -> void:
	_velocity = initial_velocity
	_airborne = true


func _physics_process(delta: float) -> void:
	if not _airborne:
		return
	_velocity.y -= gravity * delta
	_velocity *= 1.0 - drag * delta
	global_position += _velocity * delta

	if global_position.y <= water_height:
		_on_water_impact()


func _on_water_impact() -> void:
	_airborne = false
	global_position.y = water_height
	_velocity = Vector3.ZERO
	_splash.restart()
	_splash.emitting = true
	landed.emit(global_position)
