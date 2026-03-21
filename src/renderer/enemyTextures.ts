/**
 * Enemy Texture Registry — Renderer only.
 *
 * Loads all 8 enemy PNG assets via PixiJS Assets and exposes a typed lookup
 * by EnemyType enum value.  Call loadEnemyTextures() once during startup
 * (inside initPixi().then()) before the game loop begins.
 */

import { Assets, Texture } from 'pixi.js'
import { EnemyType } from '@game/ecs/component'

// Vite resolves these at build time — results in content-hashed URLs in prod.
import dataLeechUrl        from '../assets/enemies/DataLeech.png?url'
import codeRunnerUrl       from '../assets/enemies/CodeRunner.png?url'
import firewallBreacherUrl from '../assets/enemies/FIREWallBreacher.png?url'
import glitchUrl           from '../assets/enemies/Glitch.png?url'
import orchestratorUrl     from '../assets/enemies/Orchestrator.png?url'
import vdbNetrunnerUrl     from '../assets/enemies/VDBNetRunner.png?url'
import saboteurUrl         from '../assets/enemies/Saboteur.png?url'
import aiOverlordUrl       from '../assets/enemies/AIOverlord.png?url'

/** Maps EnemyType enum value → resolved URL string. */
const ENEMY_URLS: Record<EnemyType, string> = {
  [EnemyType.DATA_LEECH]:        dataLeechUrl,
  [EnemyType.CODE_RUNNER]:       codeRunnerUrl,
  [EnemyType.FIREWALL_BREACHER]: firewallBreacherUrl,
  [EnemyType.GLITCH]:            glitchUrl,
  [EnemyType.ORCHESTRATOR]:      orchestratorUrl,
  [EnemyType.VDB_NETRUNNER]:     vdbNetrunnerUrl,
  [EnemyType.SABOTEUR]:          saboteurUrl,
  [EnemyType.AI_OVERLORD]:       aiOverlordUrl,
}

/** Loaded textures indexed by EnemyType value. Populated by loadEnemyTextures(). */
const textures = new Map<EnemyType, Texture>()

/**
 * Load all enemy textures into the PixiJS asset cache.
 * Must be awaited before the game loop starts.
 */
export async function loadEnemyTextures(): Promise<void> {
  await Promise.all(
    (Object.entries(ENEMY_URLS) as [string, string][]).map(async ([typeStr, url]) => {
      const enemyType = Number(typeStr) as EnemyType
      const texture = await Assets.load<Texture>(url)
      textures.set(enemyType, texture)
    }),
  )
}

/**
 * Returns the PixiJS Texture for a given EnemyType.
 * Throws if loadEnemyTextures() has not been called yet.
 */
export function getEnemyTexture(enemyType: EnemyType): Texture {
  const tex = textures.get(enemyType)
  if (!tex) throw new Error(`Enemy texture not loaded for EnemyType ${enemyType} — call loadEnemyTextures() first`)
  return tex
}
