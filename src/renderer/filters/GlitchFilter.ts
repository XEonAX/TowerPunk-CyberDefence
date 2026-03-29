/**
 * GlitchFilter — Custom PixiJS 8 Filter for the loading screen transition effect.
 *
 * Implements a layered Cyberpunk-style data-corruption pipeline:
 *   1. Banded horizontal shear  — clustered scanline displacement
 *   2. Block fragmentation      — rectangular chunk drift
 *   3. RGB channel split        — chromatic aberration offset
 *
 * Uniforms:
 *   uIntensity  [0, 1]  — overall corruption strength (0 = clean, 1 = full chaos)
 *   uTime       float   — monotonic time in seconds, drives pseudo-random seeding
 */

import { Filter, GlProgram } from 'pixi.js'

// ── Vertex shader (standard PixiJS 8 filter passthrough) ────────────────────
const VERTEX = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void)
  {
      vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
      position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
      position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
      return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void)
  {
      return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void)
  {
      gl_Position    = filterVertexPosition();
      vTextureCoord  = filterTextureCoord();
  }
`

// ── Fragment shader ──────────────────────────────────────────────────────────
const FRAGMENT = `
  in vec2 vTextureCoord;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uIntensity;

  // Low-quality hash for fast pseudo-random values in shader
  float hash(float n)
  {
      return fract(sin(n) * 43758.5453123);
  }

  void main(void)
  {
      vec2 uv = vTextureCoord;

      if (uIntensity > 0.001)
      {
          float frameSlot = floor(uTime * 20.0);

          // ── 1. Banded horizontal shear ──────────────────────────────────
          // Divide the screen into ~120 horizontal slices.
          // Each slice gets a random X offset; only ~30% of slices activate.
          float band  = floor(uv.y * 120.0);
          float shift = (hash(band + frameSlot) - 0.5);
          float mask  = step(0.7, hash(band * 1.3 + uTime));
          uv.x       += shift * 0.25 * mask * uIntensity;

          // ── 2. Block fragmentation ──────────────────────────────────────
          // Divide screen into blocks; some blocks drift independently.
          float blockX     = floor(uv.x * 40.0);
          float blockY     = floor(uv.y * 40.0);
          float blockNoise = hash(blockX * 7.13 + blockY * 3.77 + frameSlot);
          if (blockNoise > 1.0 - 0.3 * uIntensity)
          {
              uv.x += 0.1 * uIntensity * (hash(blockNoise * 17.3) - 0.5);
          }

          uv.x = clamp(uv.x, 0.0, 1.0);
          uv.y = clamp(uv.y, 0.0, 1.0);
      }

      // ── 3. RGB channel split (chromatic aberration) ─────────────────────
      float split  = 0.015 * uIntensity;
      vec4 rSample = texture2D(uTexture, vec2(clamp(uv.x + split, 0.0, 1.0), uv.y));
      vec4 gSample = texture2D(uTexture, uv);
      vec4 bSample = texture2D(uTexture, vec2(clamp(uv.x - split, 0.0, 1.0), uv.y));

      gl_FragColor = vec4(rSample.r, gSample.g, bSample.b, gSample.a);
  }
`

// ── Type helper for uniform group access ────────────────────────────────────
interface GlitchUniformGroup {
  uniforms: {
    uTime: number
    uIntensity: number
  }
}

// ────────────────────────────────────────────────────────────────────────────

export class GlitchFilter extends Filter {
  constructor() {
    super({
      glProgram: new GlProgram({ vertex: VERTEX, fragment: FRAGMENT }),
      resources: {
        glitchUniforms: {
          uTime:      { value: 0, type: 'f32' },
          uIntensity: { value: 0, type: 'f32' },
        },
      },
    })
  }

  private get _uniforms(): GlitchUniformGroup['uniforms'] {
    return (this.resources.glitchUniforms as unknown as GlitchUniformGroup).uniforms
  }

  get intensity(): number {
    return this._uniforms.uIntensity
  }

  set intensity(v: number) {
    this._uniforms.uIntensity = v
  }

  get time(): number {
    return this._uniforms.uTime
  }

  set time(v: number) {
    this._uniforms.uTime = v
  }
}
