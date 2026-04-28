/**
 * Audio Assets Registry
 *
 * Defines every sound used in the game: its public URL path, which volume
 * channel it belongs to, and optional default rate / loop settings.
 * All paths are rooted at /public (served as-is by Vite, no hashing).
 */

// ---------------------------------------------------------------------------
// Sound IDs — used everywhere in the codebase to reference sounds by name.
// const enum → inlined at compile time, zero runtime overhead.
// ---------------------------------------------------------------------------

export const enum SoundId {
  // ── Loading screen ────────────────────────────────────────────────────────
  LOADING_GLITCH_1      = 'loading_glitch1',
  LOADING_GLITCH_2      = 'loading_glitch2',
  LOADING_GLITCH_3      = 'loading_glitch3',
  LOADING_GLITCH_4      = 'loading_glitch4',
  LOADING_PHASER_UP     = 'loading_phaser_up',
  LOADING_LANDING_STING = 'loading_landing_sting',
  LOADING_LANDING_BASS  = 'loading_landing_bass',

  // ── UI ────────────────────────────────────────────────────────────────────
  UI_CLICK       = 'ui_click',
  UI_HOVER       = 'ui_hover',
  UI_ERROR       = 'ui_error',
  UI_CONFIRM     = 'ui_confirm',
  UI_PANEL_OPEN  = 'ui_panel_open',
  UI_PANEL_CLOSE = 'ui_panel_close',
  UI_TOGGLE      = 'ui_toggle',

  // ── Tower placement ───────────────────────────────────────────────────────
  TOWER_PLACE_ICE_WALL  = 'tower_place_ice_wall',
  TOWER_PLACE_FIREWALL  = 'tower_place_firewall',
  TOWER_PLACE_GENERIC   = 'tower_place_generic',
  TOWER_PLACE_SNIPER    = 'tower_place_sniper',
  TOWER_PLACE_BLACKWALL = 'tower_place_blackwall',
  TOWER_PLACE_PING      = 'tower_place_ping',
  TOWER_PLACE_HARVESTER = 'tower_place_harvester',
  TOWER_UPGRADE         = 'tower_upgrade',
  TOWER_UPGRADE_MAX     = 'tower_upgrade_max',
  TOWER_DISMANTLE       = 'tower_dismantle',
  TOWER_DESTROYED       = 'tower_destroyed',

  // ── Tower attacks ─────────────────────────────────────────────────────────
  ATTACK_ICE_WALL   = 'attack_ice_wall',
  ATTACK_FIREWALL   = 'attack_firewall',
  ATTACK_DATA_SPIKE = 'attack_data_spike',
  ATTACK_TURRET     = 'attack_turret',
  ATTACK_SNIPER     = 'attack_sniper',
  ATTACK_BLACKWALL  = 'attack_blackwall',
  ATTACK_PING       = 'attack_ping',

  // ── Enemy events ──────────────────────────────────────────────────────────
  ENEMY_SPAWN      = 'enemy_spawn',
  ENEMY_DEATH      = 'enemy_death',
  ENEMY_DEATH_BOSS = 'enemy_death_boss',
  ENEMY_DAMAGE     = 'enemy_damage',

  // ── Enemy ambient loops (looping, fade in/out on presence) ───────────────
  LOOP_DATA_LEECH   = 'loop_data_leech',
  LOOP_CODE_RUNNER  = 'loop_code_runner',
  LOOP_BREACHER     = 'loop_breacher',
  LOOP_GLITCH       = 'loop_glitch',
  LOOP_ORCHESTRATOR = 'loop_orchestrator',
  LOOP_NETRUNNER    = 'loop_netrunner',
  LOOP_SABOTEUR     = 'loop_saboteur',
  LOOP_OVERLORD     = 'loop_overlord',

  // ── Game phase events ─────────────────────────────────────────────────────
  WAVE_START          = 'wave_start',
  WAVE_END            = 'wave_end',
  BREACH_OPEN         = 'breach_open',
  BREACH_CLOSE        = 'breach_close',
  GAME_OVER           = 'game_over',
  VICTORY             = 'victory',
  ABILITY_ACTIVATE    = 'ability_activate',
  PICKUP_COLLECT      = 'pickup_collect',
  RESOURCE_EDDIE      = 'resource_eddie',
  RESOURCE_COMPONENT  = 'resource_component',
  STATUS_SLOW         = 'status_slow',
  STATUS_STUN         = 'status_stun',
}

// ---------------------------------------------------------------------------
// Channel enum — controls which volume slider applies to each sound.
// ---------------------------------------------------------------------------

export const enum AudioChannel {
  SFX     = 'sfx',
  UI      = 'ui',
  AMBIENT = 'ambient',
}

// ---------------------------------------------------------------------------
// Sound definition
// ---------------------------------------------------------------------------

export interface SoundDef {
  /** Public URL path(s). Howler tries each in order until one plays. */
  src: string[]
  channel: AudioChannel
  /** Base volume multiplied by the channel volume at play time. 0–1. */
  volume: number
  /** True for ambient loops. */
  loop?: boolean
  /** Playback rate (1.0 = normal, 1.4 = faster/higher pitch). */
  rate?: number
}

// ---------------------------------------------------------------------------
// Registry — keyed by SoundId string values.
// ---------------------------------------------------------------------------

export const SOUND_DEFS: Record<string, SoundDef> = {

  // ── Loading screen ────────────────────────────────────────────────────────
  [SoundId.LOADING_GLITCH_1]:      { src: ['/audio/loading/glitch1.ogg'],        channel: AudioChannel.UI,      volume: 0.55 },
  [SoundId.LOADING_GLITCH_2]:      { src: ['/audio/loading/glitch2.ogg'],        channel: AudioChannel.UI,      volume: 0.55 },
  [SoundId.LOADING_GLITCH_3]:      { src: ['/audio/loading/glitch3.ogg'],        channel: AudioChannel.UI,      volume: 0.55 },
  [SoundId.LOADING_GLITCH_4]:      { src: ['/audio/loading/glitch4.ogg'],        channel: AudioChannel.UI,      volume: 0.55 },
  [SoundId.LOADING_PHASER_UP]:     { src: ['/audio/loading/phaser-up.ogg'],      channel: AudioChannel.UI,      volume: 0.30, rate: 0.7 },
  [SoundId.LOADING_LANDING_STING]: { src: ['/audio/loading/landing-sting.ogg'],  channel: AudioChannel.UI,      volume: 0.70 },
  [SoundId.LOADING_LANDING_BASS]:  { src: ['/audio/game/low-explosion.ogg'],      channel: AudioChannel.UI,      volume: 0.50 },

  // ── UI ────────────────────────────────────────────────────────────────────
  [SoundId.UI_CLICK]:       { src: ['/audio/ui/click.ogg'],       channel: AudioChannel.UI, volume: 0.40 },
  [SoundId.UI_HOVER]:       { src: ['/audio/ui/hover.ogg'],       channel: AudioChannel.UI, volume: 0.40 },
  [SoundId.UI_ERROR]:       { src: ['/audio/ui/error.ogg'],       channel: AudioChannel.UI, volume: 0.50 },
  [SoundId.UI_CONFIRM]:     { src: ['/audio/ui/confirm.ogg'],     channel: AudioChannel.UI, volume: 0.50 },
  [SoundId.UI_PANEL_OPEN]:  { src: ['/audio/ui/panel-open.ogg'],  channel: AudioChannel.UI, volume: 0.40 },
  [SoundId.UI_PANEL_CLOSE]: { src: ['/audio/ui/panel-close.ogg'], channel: AudioChannel.UI, volume: 0.40 },
  [SoundId.UI_TOGGLE]:      { src: ['/audio/ui/toggle.ogg'],      channel: AudioChannel.UI, volume: 0.40 },

  // ── Tower placement ───────────────────────────────────────────────────────
  [SoundId.TOWER_PLACE_ICE_WALL]:  { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_PLACE_FIREWALL]:  { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_PLACE_GENERIC]:   { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_PLACE_SNIPER]:    { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_PLACE_BLACKWALL]: { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_PLACE_PING]:      { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_PLACE_HARVESTER]: { src: ['/audio/towers/place-generic.ogg'],   channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_UPGRADE]:         { src: ['/audio/towers/upgrade.ogg'],         channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.TOWER_UPGRADE_MAX]:     { src: ['/audio/towers/upgrade-max.ogg'],     channel: AudioChannel.SFX, volume: 0.70 },
  [SoundId.TOWER_DISMANTLE]:       { src: ['/audio/towers/dismantle.ogg'],       channel: AudioChannel.SFX, volume: 0.50 },
  [SoundId.TOWER_DESTROYED]:       { src: ['/audio/towers/destroyed.ogg'],       channel: AudioChannel.SFX, volume: 0.60 },

  // ── Tower attacks ─────────────────────────────────────────────────────────
  [SoundId.ATTACK_ICE_WALL]:   { src: ['/audio/towers/attack-ice.ogg'],        channel: AudioChannel.SFX, volume: 0.18 },
  [SoundId.ATTACK_FIREWALL]:   { src: ['/audio/towers/attack-firewall.ogg'],   channel: AudioChannel.SFX, volume: 0.28 },
  [SoundId.ATTACK_DATA_SPIKE]: { src: ['/audio/towers/attack-data-spike.ogg'], channel: AudioChannel.SFX, volume: 0.50 },
  [SoundId.ATTACK_TURRET]:     { src: ['/audio/towers/attack-turret.ogg'],     channel: AudioChannel.SFX, volume: 0.22 },
  [SoundId.ATTACK_SNIPER]:     { src: ['/audio/towers/attack-sniper.ogg'],     channel: AudioChannel.SFX, volume: 0.45 },
  [SoundId.ATTACK_BLACKWALL]:  { src: ['/audio/towers/attack-blackwall.ogg'],  channel: AudioChannel.SFX, volume: 0.50, rate: 0.7 },
  [SoundId.ATTACK_PING]:       { src: ['/audio/towers/ping-pulse.ogg'],        channel: AudioChannel.SFX, volume: 0.18, rate: 1.3 },

  // ── Enemy events ──────────────────────────────────────────────────────────
  [SoundId.ENEMY_SPAWN]:      { src: ['/audio/enemies/spawn.ogg'],     channel: AudioChannel.SFX, volume: 0.28 },
  [SoundId.ENEMY_DEATH]:      { src: ['/audio/enemies/death.ogg'],     channel: AudioChannel.SFX, volume: 0.32 },
  [SoundId.ENEMY_DEATH_BOSS]: { src: ['/audio/enemies/death-boss.ogg'],channel: AudioChannel.SFX, volume: 0.70 },
  [SoundId.ENEMY_DAMAGE]:     { src: ['/audio/enemies/damage.ogg'],    channel: AudioChannel.SFX, volume: 0.12 },

  // ── Enemy ambient loops ───────────────────────────────────────────────────
  [SoundId.LOOP_DATA_LEECH]:   { src: ['/audio/enemies/loop-data-leech.ogg'],   channel: AudioChannel.AMBIENT, volume: 0.20, loop: true },
  [SoundId.LOOP_CODE_RUNNER]:  { src: ['/audio/enemies/loop-code-runner.ogg'],  channel: AudioChannel.AMBIENT, volume: 0.20, loop: true, rate: 1.4 },
  [SoundId.LOOP_BREACHER]:     { src: ['/audio/enemies/loop-breacher.ogg'],     channel: AudioChannel.AMBIENT, volume: 0.25, loop: true },
  [SoundId.LOOP_GLITCH]:       { src: ['/audio/enemies/loop-glitch.ogg'],       channel: AudioChannel.AMBIENT, volume: 0.20, loop: true },
  [SoundId.LOOP_ORCHESTRATOR]: { src: ['/audio/enemies/loop-orchestrator.ogg'], channel: AudioChannel.AMBIENT, volume: 0.30, loop: true },
  [SoundId.LOOP_NETRUNNER]:    { src: ['/audio/enemies/loop-netrunner.ogg'],    channel: AudioChannel.AMBIENT, volume: 0.30, loop: true, rate: 0.8 },
  [SoundId.LOOP_SABOTEUR]:     { src: ['/audio/enemies/loop-saboteur.ogg'],     channel: AudioChannel.AMBIENT, volume: 0.22, loop: true, rate: 0.9 },
  [SoundId.LOOP_OVERLORD]:     { src: ['/audio/enemies/loop-overlord.ogg'],     channel: AudioChannel.AMBIENT, volume: 0.40, loop: true },

  // ── Game phase events ─────────────────────────────────────────────────────
  [SoundId.WAVE_START]:         { src: ['/audio/game/wave-start.ogg'],         channel: AudioChannel.SFX, volume: 0.70 },
  [SoundId.WAVE_END]:           { src: ['/audio/game/wave-end.ogg'],           channel: AudioChannel.SFX, volume: 0.60 },
  [SoundId.BREACH_OPEN]:        { src: ['/audio/game/low-explosion.ogg'],       channel: AudioChannel.SFX, volume: 0.65 },
  [SoundId.BREACH_CLOSE]:       { src: ['/audio/game/breach-close.ogg'],        channel: AudioChannel.SFX, volume: 0.55 },
  [SoundId.GAME_OVER]:          { src: ['/audio/game/game-over.ogg'],           channel: AudioChannel.SFX, volume: 0.70 },
  [SoundId.VICTORY]:            { src: ['/audio/game/victory.ogg'],             channel: AudioChannel.SFX, volume: 0.70 },
  [SoundId.ABILITY_ACTIVATE]:   { src: ['/audio/game/ability.ogg'],             channel: AudioChannel.SFX, volume: 0.50 },
  [SoundId.PICKUP_COLLECT]:     { src: ['/audio/game/pickup.ogg'],              channel: AudioChannel.SFX, volume: 0.28 },
  [SoundId.RESOURCE_EDDIE]:     { src: ['/audio/game/resource-eddie.ogg'],      channel: AudioChannel.SFX, volume: 0.22, rate: 1.2 },
  [SoundId.RESOURCE_COMPONENT]: { src: ['/audio/game/resource-component.ogg'], channel: AudioChannel.SFX, volume: 0.22 },
  [SoundId.STATUS_SLOW]:        { src: ['/audio/game/slow.ogg'],                channel: AudioChannel.SFX, volume: 0.10, rate: 1.3 },
  [SoundId.STATUS_STUN]:        { src: ['/audio/game/stun.ogg'],                channel: AudioChannel.SFX, volume: 0.18 },
}
