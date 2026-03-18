/**
 * Tower Texture Registry — Renderer only.
 *
 * Loads all 8 tower PNG assets via PixiJS Assets and exposes a typed lookup
 * by TowerType enum value.  Call loadTowerTextures() once during startup
 * (inside initPixi().then()) before the game loop begins.
 */

import { Assets, Texture } from 'pixi.js'
import { TowerType } from '@game/ecs/component'

// Vite resolves these at build time — results in content-hashed URLs in prod.
import iceWallUrl      from '../assets/towers/ICEWall.png?url'
import firewallUrl     from '../assets/towers/FIREWall.png?url'
import dataSpikeUrl    from '../assets/towers/Dataspike.png?url'
import daemonTurretUrl from '../assets/towers/DaemonTurret.png?url'
import iceSniperUrl    from '../assets/towers/ICESniper.png?url'
import blackwallUrl    from '../assets/towers/Blackwall.png?url'
import pingUrl         from '../assets/towers/Ping.png?url'
import harvesterUrl    from '../assets/towers/Harvestor.png?url'

/** Maps TowerType enum value → resolved URL string. */
const TOWER_URLS: Record<TowerType, string> = {
  [TowerType.ICE_WALL]:     iceWallUrl,
  [TowerType.FIREWALL]:     firewallUrl,
  [TowerType.DATA_SPIKE]:   dataSpikeUrl,
  [TowerType.DAEMON_TURRET]:daemonTurretUrl,
  [TowerType.ICE_SNIPER]:   iceSniperUrl,
  [TowerType.BLACKWALL]:    blackwallUrl,
  [TowerType.PING]:         pingUrl,
  [TowerType.HARVESTER]:    harvesterUrl,
}

/** Loaded textures indexed by TowerType value. Populated by loadTowerTextures(). */
const textures = new Map<TowerType, Texture>()

/**
 * Load all tower textures into the PixiJS asset cache.
 * Must be awaited before the game loop starts.
 */
export async function loadTowerTextures(): Promise<void> {
  await Promise.all(
    (Object.entries(TOWER_URLS) as [string, string][]).map(async ([typeStr, url]) => {
      const towerType = Number(typeStr) as TowerType
      const texture = await Assets.load<Texture>(url)
      textures.set(towerType, texture)
    })
  )
}

/**
 * Returns the PixiJS Texture for a given TowerType.
 * Throws if loadTowerTextures() has not been called yet.
 */
export function getTowerTexture(towerType: TowerType): Texture {
  const tex = textures.get(towerType)
  if (!tex) throw new Error(`Tower texture not loaded for TowerType ${towerType} — call loadTowerTextures() first`)
  return tex
}
