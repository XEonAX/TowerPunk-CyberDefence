/**
 * Audio Event Types
 *
 * Defines the typed event enum written by simulation systems into the
 * World's audio event ring buffer. Audio is non-deterministic and lives
 * outside the simulation layer — these values are the bridge.
 *
 * The event bus itself (Uint8Array buffers + count) lives on the World
 * so simulation systems can write to it without importing anything from
 * the audio module (avoiding circular deps).
 */

/** Maximum audio events buffered per RAF frame (4 ticks × ~64 events). */
export const AUDIO_EVENT_CAPACITY = 512

/**
 * Event types emitted by simulation systems.
 * Values are uint8 — must stay in range 0–255.
 */
export const enum AudioEventType {
  ENEMY_SPAWNED      = 0,
  ENEMY_DIED         = 1,
  ENEMY_BOSS_DIED    = 2,
  ENEMY_DAMAGED      = 3,
  TOWER_PLACED       = 4,
  TOWER_PLACE_FAILED = 5,
  TOWER_UPGRADED     = 6,
  TOWER_UPGRADE_MAX  = 7,
  TOWER_DISMANTLED   = 8,
  TOWER_DESTROYED    = 9,
  ABILITY_ACTIVATED  = 10,
  WAVE_STARTED       = 11,
  WAVE_ENDED         = 12,
  BREACH_OPENED      = 13,
  BREACH_CLOSED      = 14,
  GAME_OVER          = 15,
  VICTORY            = 16,
  PICKUP_COLLECTED   = 17,
  STATUS_SLOW        = 18,
  STATUS_STUN        = 19,
  TOWER_ATTACK       = 20,
  RESOURCE_GAINED    = 21,
}
