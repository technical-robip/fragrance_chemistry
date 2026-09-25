import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: {
  points: [number, number][];
  depth: number;
  holes?: [number, number][][];
  ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[];
}): THREE.ExtrudeGeometry {
  const holes = [
    ...(profile.holes ?? []),
    ...(profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)),
  ];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: {
  points: [number, number][];
  segments?: number;
}): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' +
      hex
        .slice(1)
        .split('')
        .map((part) => part + part)
        .join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized)
    ? Number.parseInt(normalized.slice(1), 16)
    : 0x8a7a5f;
  return [
    clampAlbedoChannel((value >> 16) & 255),
    clampAlbedoChannel((value >> 8) & 255),
    clampAlbedoChannel(value & 255),
  ];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0)
    return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [
    spec.baseColor ?? spec.color ?? spec.albedo?.dominant,
    ...(Array.isArray(secondary) ? secondary : []),
  ];
  return colors.filter(
    (value): value is string => typeof value === 'string' && value.startsWith('#'),
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(
  x: number,
  y: number,
  seed: number,
  periodX: number,
  periodY: number,
): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value =
    Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(
  u: number,
  v: number,
  seed: number,
  periodX: number,
  periodY: number,
): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [
      {
        frequency,
        amplitude,
        stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
        stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
        ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
      },
    ];
  });
  return parsed.length > 0
    ? parsed
    : [
        { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
        { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
        { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
      ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [
    clampAlbedoChannel(Number(match[1])),
    clampAlbedoChannel(Number(match[2])),
    clampAlbedoChannel(Number(match[3])),
  ];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(
  gradient: ColorGradientSpec,
  u: number,
  v: number,
): [number, number, number] {
  const stops =
    gradient.stops.length >= 2
      ? gradient.stops
      : [
          { offset: 0, color: 'rgba(138,122,95,1)' },
          { offset: 1, color: 'rgba(138,122,95,1)' },
        ];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(
  data: Uint8ClampedArray,
  offset: number,
  red: number,
  green: number,
  blue: number,
): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection =
    spec.textureProjection && typeof spec.textureProjection === 'object'
      ? spec.textureProjection
      : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(
    1,
    Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8),
  );
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence =
    typeof reference.confidence === 'number'
      ? reference.confidence
      : typeof reference.estimatedFidelity === 'number'
        ? reference.estimatedFidelity
        : 0;
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection =
    spec.textureProjection && typeof spec.textureProjection === 'object'
      ? spec.textureProjection
      : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(
    1,
    Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8),
  );
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize =
    typeof requested === 'number' && Number.isFinite(requested)
      ? requested
      : qualityFirst
        ? 1024
        : 512;
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (
    !contexts.albedo ||
    !contexts.roughness ||
    !contexts.height ||
    !contexts.normal ||
    !contexts.ao
  )
    return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(
    readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18),
  );
  const heightCorrelation = clamp01(
    readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3),
  );
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation,
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(
    0.05,
    readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35),
  );
  const aoStrength = clamp01(
    readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35),
  );
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx =
        (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage =
        (heightField[y * size + left] +
          heightField[y * size + right] +
          heightField[up + x] +
          heightField[down + x]) *
        0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data,
        offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
  denseComponent = false,
): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : (makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options));
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(
      0.001,
      readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity),
    ),
    attenuationColor: new THREE.Color(
      typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff',
    ),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(
      readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0),
    ),
    specularColor: new THREE.Color(
      typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff',
    ),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent:
      readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 ||
      readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(
      Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)),
    );
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(
      spec.ambientOcclusion,
      ['cavityStrength', 'strength'],
      0.35,
    );
    const denseMesh =
      denseComponent ||
      spec.denseMesh === true ||
      spec.geometryDensity === 'dense' ||
      spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(
      0,
      readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0),
    );
    const effectiveDisplacementScale = denseMesh
      ? Math.max(0.005, displacementScale)
      : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = {
    albedoRange: [30, 240],
    binaryMetalness: true,
    f0Range: [0.02, 1],
    iorRange: [1, 2.5],
  };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId =
    spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number')
  ) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  );
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Packaged unit 50 ml flacon
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createPackagedUnit50MlFlaconModel(
  options: ProceduralModelOptions = {},
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Packaged unit 50 ml flacon';
  root.userData.reconstructionEvidence = {
    itemFamily: null,
    subtype: null,
    componentAdapter: null,
    route: null,
    exactnessTier: null,
    referenceCamera: {
      solved: false,
      fovDegrees: 40.0,
      aspect: 1.0,
      orientation: { yaw: 0.0, pitch: 0.0, roll: 0.0 },
      positionHint: [0.0, 0.0, 3.0],
      note: 'For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review.',
    },
    approximationNotes: [],
  };
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap['glass'] = createSculptMaterial(
    'glass',
    {
      id: 'glass',
      name: 'Flacon glass',
      type: 'physical',
      shaderModel: 'MeshPhysicalMaterial, transmission',
      baseColor: '#eaf2f2',
      color: '#eaf2f2',
      albedo: {
        dominant: '#6E542D',
        secondary: ['#574222', '#3E311A', '#9E8256'],
        samplingNotes:
          'Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.',
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_albedo.png',
          url: '/media/flacon/glass/glass_albedo.png',
          channel: 'albedo',
          source: 'reference-pixel-extraction',
        },
      },
      colorVariation: {
        palette: ['#6E542D', '#574222', '#3E311A', '#9E8256', '#CFBFA3'],
        pattern: 'reference-derived pixel palette',
        amplitude: 0.215,
        heightCorrelation: 0.42,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: 'uv',
        repeat: [2.0, 2.0],
        anisotropy: 8,
        texelDensityIntent:
          'Preserve stable world/object-scale detail; do not stretch micro detail with component scale.',
      },
      surfaceFrequencyBands: [
        {
          id: 'macro',
          frequency: 1.0,
          amplitude: 0.0006,
          note: 'Form only: faces and fillets are geometry; the glass itself is smooth.',
        },
        {
          id: 'meso',
          frequency: 8.0,
          amplitude: 0.001,
          note: 'Very faint moulding undulation across the faces, near visibility limit.',
        },
        {
          id: 'micro',
          frequency: 110.0,
          amplitude: 0.0004,
          note: 'Polished micro-roughness; stops the highlight reading as a mirror.',
        },
      ],
      roughness: {
        base: 0.045,
        map: '/media/flacon/glass/glass_roughness.png',
        source: 'reference-pixel-extraction, independent of the albedo map',
      },
      metalness: 0.0,
      normal: { map: '/media/flacon/glass/glass_normal.png', scale: 0.6 },
      bump: {
        pattern: 'reference-derived height field',
        amplitude: 0.021,
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_height.png',
          url: '/media/flacon/glass/glass_height.png',
          channel: 'height',
          source: 'reference-pixel-extraction',
        },
      },
      displacement: { pattern: 'none', amplitude: 0.0, scale: 1.0, silhouetteAffects: false },
      ambientOcclusion: {
        map: '/media/flacon/glass/glass_ao.png',
        intensity: 0.8,
        source: 'reference-pixel-extraction, independent of the albedo and roughness maps',
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: '#2F2A22' },
      localOverrides: [
        {
          id: 'baseSlabDensity',
          target: 'bottleBody.localFeatures.baseSlab',
          channel: 'thickness',
          note: 'Thicker in the solid foot, so it refracts more strongly.',
        },
        {
          id: 'reference-pbr-pixel-evidence',
          type: 'material-map-evidence',
          evidenceRefs: ['full-object'],
          channels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
          notes:
            'Use generated maps as material evidence, then refine after browser screenshot comparison.',
        },
      ],
      shaderNotes: [
        'Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.',
        'Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.',
        'Use normal/bump/displacement only when they map to observed surface relief.',
        'Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.',
        'Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.',
        'Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps.',
      ],
      notes: 'Replace with image-derived color, roughness, noise, and edge-wear notes.',
      pbr: {
        metalness: 0.0,
        roughness: 0.045,
        transmission: 0.94,
        ior: 1.5,
        thickness: 0.22,
        specularF0: 0.04,
      },
      declaredLimitation:
        'Transmission approximation only: no caustics, no dispersion, no real environment reflection.',
      referencePbr: {
        version: '1.0',
        sourceImage:
          '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/bottleBody.png',
        extractor: 'stage1_intake/extract_pbr_evidence.py',
        method: 'single-image pixel evidence with de-lighting estimate; not photogrammetry',
        usable: true,
        verdict: 'pass',
        confidence: 0.829,
        estimatedFidelity: 0.829,
        targetThreshold: 0.7,
        hardLimit:
          'A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.',
        maps: {
          albedo: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_albedo.png',
            url: '/media/flacon/glass/glass_albedo.png',
            channel: 'albedo',
            source: 'reference-pixel-extraction',
          },
          roughness: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_roughness.png',
            url: '/media/flacon/glass/glass_roughness.png',
            channel: 'roughness',
            source: 'reference-pixel-extraction',
          },
          height: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_height.png',
            url: '/media/flacon/glass/glass_height.png',
            channel: 'height',
            source: 'reference-pixel-extraction',
          },
          normal: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_normal.png',
            url: '/media/flacon/glass/glass_normal.png',
            channel: 'normal',
            source: 'reference-pixel-extraction',
          },
          ao: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/glass/glass_ao.png',
            url: '/media/flacon/glass/glass_ao.png',
            channel: 'ao',
            source: 'reference-pixel-extraction',
          },
        },
        diagnostics: {
          sourceWidth: 300,
          sourceHeight: 300,
          mapSize: 1024,
          cropBBoxPixels: { x: 0, y: 0, width: 300, height: 300 },
          mask: {
            backgroundColor: '#555030',
            backgroundNoise: 63.246,
            transparentPixelFraction: 0.0,
            foregroundCoverage: 0.9325,
          },
          mapStats: {
            valueRange: 0.5116,
            heightP90Gradient: 0.04601,
            roughnessBase: 0.688,
            roughnessVariation: 0.075,
            normalStrength: 0.21,
            blurRadius: 21,
          },
          palette: ['#6E542D', '#574222', '#3E311A', '#9E8256', '#CFBFA3'],
        },
        warnings: [
          'image is not clearly isolated from background; using most pixels as material evidence',
          'object/background separation is weak',
          'single-image inverse rendering cannot prove true physical PBR; confidence is capped',
        ],
      },
    },
    options,
  );
  materialMap['juice'] = createSculptMaterial(
    'juice',
    {
      id: 'juice',
      name: 'Amber juice',
      type: 'physical',
      shaderModel: 'MeshPhysicalMaterial, transmission with attenuation',
      baseColor: '#c9923e',
      color: '#c9923e',
      albedo: {
        dominant: '#70552E',
        secondary: ['#624A27', '#554020', '#483518'],
        samplingNotes:
          'Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.',
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_albedo.png',
          url: '/media/flacon/juice/juice_albedo.png',
          channel: 'albedo',
          source: 'reference-pixel-extraction',
        },
      },
      colorVariation: {
        palette: ['#70552E', '#624A27', '#554020', '#483518', '#B68F54'],
        pattern: 'reference-derived pixel palette',
        amplitude: 0.08,
        heightCorrelation: 0.42,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: 'uv',
        repeat: [2.0, 2.0],
        anisotropy: 8,
        texelDensityIntent:
          'Preserve stable world/object-scale detail; do not stretch micro detail with component scale.',
      },
      surfaceFrequencyBands: [
        { id: 'macro', frequency: 1.0, amplitude: 0.0004, note: 'Still liquid, no macro relief.' },
        {
          id: 'meso',
          frequency: 5.0,
          amplitude: 0.0005,
          note: 'Meniscus is the only meso event and it is geometry, not relief.',
        },
        { id: 'micro', frequency: 130.0, amplitude: 0.0002, note: 'Near-mirror liquid surface.' },
      ],
      roughness: {
        base: 0.02,
        map: '/media/flacon/juice/juice_roughness.png',
        source: 'reference-pixel-extraction, independent of the albedo map',
      },
      metalness: 0.0,
      normal: { map: '/media/flacon/juice/juice_normal.png', scale: 0.6 },
      bump: {
        pattern: 'reference-derived height field',
        amplitude: 0.01,
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_height.png',
          url: '/media/flacon/juice/juice_height.png',
          channel: 'height',
          source: 'reference-pixel-extraction',
        },
      },
      displacement: { pattern: 'none', amplitude: 0.0, scale: 1.0, silhouetteAffects: false },
      ambientOcclusion: {
        map: '/media/flacon/juice/juice_ao.png',
        intensity: 0.8,
        source: 'reference-pixel-extraction, independent of the albedo and roughness maps',
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: '#2F2A22' },
      localOverrides: [
        {
          id: 'depthAbsorption',
          target: 'juice',
          channel: 'attenuationDistance',
          note: 'Absorption with path length is what makes the centre read darker; this is the channel that carries it, not albedo.',
        },
        {
          id: 'reference-pbr-pixel-evidence',
          type: 'material-map-evidence',
          evidenceRefs: ['full-object'],
          channels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
          notes:
            'Use generated maps as material evidence, then refine after browser screenshot comparison.',
        },
      ],
      shaderNotes: [
        'Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.',
        'Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.',
        'Use normal/bump/displacement only when they map to observed surface relief.',
        'Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.',
        'Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.',
        'Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps.',
      ],
      notes: 'Replace with image-derived color, roughness, noise, and edge-wear notes.',
      pbr: {
        metalness: 0.0,
        roughness: 0.02,
        transmission: 0.88,
        ior: 1.45,
        thickness: 0.3,
        attenuationDistance: 0.35,
        attenuationColor: '#8f6a32',
      },
      referencePbr: {
        version: '1.0',
        sourceImage:
          '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/juice.png',
        extractor: 'stage1_intake/extract_pbr_evidence.py',
        method: 'single-image pixel evidence with de-lighting estimate; not photogrammetry',
        usable: true,
        verdict: 'pass',
        confidence: 0.751,
        estimatedFidelity: 0.751,
        targetThreshold: 0.7,
        hardLimit:
          'A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.',
        maps: {
          albedo: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_albedo.png',
            url: '/media/flacon/juice/juice_albedo.png',
            channel: 'albedo',
            source: 'reference-pixel-extraction',
          },
          roughness: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_roughness.png',
            url: '/media/flacon/juice/juice_roughness.png',
            channel: 'roughness',
            source: 'reference-pixel-extraction',
          },
          height: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_height.png',
            url: '/media/flacon/juice/juice_height.png',
            channel: 'height',
            source: 'reference-pixel-extraction',
          },
          normal: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_normal.png',
            url: '/media/flacon/juice/juice_normal.png',
            channel: 'normal',
            source: 'reference-pixel-extraction',
          },
          ao: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/juice/juice_ao.png',
            url: '/media/flacon/juice/juice_ao.png',
            channel: 'ao',
            source: 'reference-pixel-extraction',
          },
        },
        diagnostics: {
          sourceWidth: 200,
          sourceHeight: 260,
          mapSize: 1024,
          cropBBoxPixels: { x: 0, y: 0, width: 200, height: 260 },
          mask: {
            backgroundColor: '#69502B',
            backgroundNoise: 54.827,
            transparentPixelFraction: 0.0,
            foregroundCoverage: 1.0,
          },
          mapStats: {
            valueRange: 0.1492,
            heightP90Gradient: 0.02022,
            roughnessBase: 0.701,
            roughnessVariation: 0.05,
            normalStrength: 0.18,
            blurRadius: 21,
          },
          palette: ['#70552E', '#624A27', '#554020', '#483518', '#B68F54'],
        },
        warnings: [
          'image is not clearly isolated from background; using most pixels as material evidence',
          'object/background separation is weak',
          'single-image inverse rendering cannot prove true physical PBR; confidence is capped',
          'low value range weakens height/roughness inference',
        ],
      },
    },
    options,
  );
  materialMap['brushedGold'] = createSculptMaterial(
    'brushedGold',
    {
      id: 'brushedGold',
      name: 'Brushed collar',
      type: 'standard',
      shaderModel: 'MeshStandardMaterial, anisotropic intent',
      baseColor: '#c9b487',
      color: '#c9b487',
      albedo: {
        dominant: '#F0E5D8',
        secondary: ['#5E523F', '#28231A', '#CCBCA8'],
        samplingNotes:
          'Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.',
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_albedo.png',
          url: '/media/flacon/brushedGold/brushedgold_albedo.png',
          channel: 'albedo',
          source: 'reference-pixel-extraction',
        },
      },
      colorVariation: {
        palette: ['#F0E5D8', '#5E523F', '#28231A', '#CCBCA8', '#978670'],
        pattern: 'reference-derived pixel palette',
        amplitude: 0.349,
        heightCorrelation: 0.42,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: 'uv',
        repeat: [2.0, 2.0],
        anisotropy: 8,
        texelDensityIntent:
          'Preserve stable world/object-scale detail; do not stretch micro detail with component scale.',
      },
      surfaceFrequencyBands: [
        { id: 'macro', frequency: 1.0, amplitude: 0.0005, note: 'Turned sleeve; no macro relief.' },
        {
          id: 'meso',
          frequency: 16.0,
          amplitude: 0.002,
          note: 'Axial brushing bands at the striation pitch read in zone-r0c1.',
        },
        {
          id: 'micro',
          frequency: 240.0,
          amplitude: 0.0012,
          note: 'Grain inside each stroke; carries the anisotropic highlight.',
        },
      ],
      roughness: {
        base: 0.31,
        map: '/media/flacon/brushedGold/brushedgold_roughness.png',
        source: 'reference-pixel-extraction, independent of the albedo map',
      },
      metalness: 1.0,
      normal: { map: '/media/flacon/brushedGold/brushedgold_normal.png', scale: 0.6 },
      bump: {
        pattern: 'reference-derived height field',
        amplitude: 0.01,
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_height.png',
          url: '/media/flacon/brushedGold/brushedgold_height.png',
          channel: 'height',
          source: 'reference-pixel-extraction',
        },
      },
      displacement: { pattern: 'none', amplitude: 0.0, scale: 1.0, silhouetteAffects: false },
      ambientOcclusion: {
        map: '/media/flacon/brushedGold/brushedgold_ao.png',
        intensity: 0.8,
        source: 'reference-pixel-extraction, independent of the albedo and roughness maps',
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: '#2F2A22' },
      localOverrides: [
        {
          id: 'circumferentialBrushing',
          target: 'collar',
          channel: 'roughness',
          note: 'AXIAL striations, corrected from the first-pass reading. Roughness is modulated along the circumference so the streaks run parallel to the axis. The override id is kept for traceability to the detail inventory entry.',
        },
        {
          id: 'reference-pbr-pixel-evidence',
          type: 'material-map-evidence',
          evidenceRefs: ['full-object'],
          channels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
          notes:
            'Use generated maps as material evidence, then refine after browser screenshot comparison.',
        },
      ],
      shaderNotes: [
        'Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.',
        'Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.',
        'Use normal/bump/displacement only when they map to observed surface relief.',
        'Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.',
        'Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.',
        'Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps.',
      ],
      notes: 'Replace with image-derived color, roughness, noise, and edge-wear notes.',
      pbr: { metalness: 1.0, roughness: 0.31, specularF0: null },
      referencePbr: {
        version: '1.0',
        sourceImage:
          '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/collar.png',
        extractor: 'stage1_intake/extract_pbr_evidence.py',
        method: 'single-image pixel evidence with de-lighting estimate; not photogrammetry',
        usable: true,
        verdict: 'pass',
        confidence: 0.764,
        estimatedFidelity: 0.764,
        targetThreshold: 0.7,
        hardLimit:
          'A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.',
        maps: {
          albedo: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_albedo.png',
            url: '/media/flacon/brushedGold/brushedgold_albedo.png',
            channel: 'albedo',
            source: 'reference-pixel-extraction',
          },
          roughness: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_roughness.png',
            url: '/media/flacon/brushedGold/brushedgold_roughness.png',
            channel: 'roughness',
            source: 'reference-pixel-extraction',
          },
          height: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_height.png',
            url: '/media/flacon/brushedGold/brushedgold_height.png',
            channel: 'height',
            source: 'reference-pixel-extraction',
          },
          normal: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_normal.png',
            url: '/media/flacon/brushedGold/brushedgold_normal.png',
            channel: 'normal',
            source: 'reference-pixel-extraction',
          },
          ao: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/brushedGold/brushedgold_ao.png',
            url: '/media/flacon/brushedGold/brushedgold_ao.png',
            channel: 'ao',
            source: 'reference-pixel-extraction',
          },
        },
        diagnostics: {
          sourceWidth: 210,
          sourceHeight: 55,
          mapSize: 1024,
          cropBBoxPixels: { x: 0, y: 0, width: 210, height: 55 },
          mask: {
            backgroundColor: '#554734',
            backgroundNoise: 11.747,
            transparentPixelFraction: 0.0,
            foregroundCoverage: 0.9984,
          },
          mapStats: {
            valueRange: 0.8302,
            heightP90Gradient: 0.01141,
            roughnessBase: 0.69,
            roughnessVariation: 0.05,
            normalStrength: 0.17,
            blurRadius: 21,
          },
          palette: ['#F0E5D8', '#5E523F', '#28231A', '#CCBCA8', '#978670'],
        },
        warnings: [
          'image is not clearly isolated from background; using most pixels as material evidence',
          'object/background separation is weak',
          'single-image inverse rendering cannot prove true physical PBR; confidence is capped',
        ],
      },
    },
    options,
  );
  materialMap['satinCharcoal'] = createSculptMaterial(
    'satinCharcoal',
    {
      id: 'satinCharcoal',
      name: 'Satin overcap',
      type: 'standard',
      shaderModel: 'MeshStandardMaterial',
      baseColor: '#26292c',
      color: '#26292c',
      albedo: {
        dominant: '#414345',
        secondary: ['#0D1112', '#1E2225', '#5F6164'],
        samplingNotes:
          'Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.',
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_albedo.png',
          url: '/media/flacon/satinCharcoal/satincharcoal_albedo.png',
          channel: 'albedo',
          source: 'reference-pixel-extraction',
        },
      },
      colorVariation: {
        palette: ['#414345', '#0D1112', '#1E2225', '#5F6164', '#8F9093'],
        pattern: 'reference-derived pixel palette',
        amplitude: 0.207,
        heightCorrelation: 0.42,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: 'uv',
        repeat: [2.0, 2.0],
        anisotropy: 8,
        texelDensityIntent:
          'Preserve stable world/object-scale detail; do not stretch micro detail with component scale.',
      },
      surfaceFrequencyBands: [
        {
          id: 'macro',
          frequency: 1.0,
          amplitude: 0.0005,
          note: 'Moulded cylinder; no macro relief.',
        },
        {
          id: 'meso',
          frequency: 11.0,
          amplitude: 0.0006,
          note: 'The two turned grooves; geometry, so this band only carries AO.',
        },
        {
          id: 'micro',
          frequency: 170.0,
          amplitude: 0.002,
          note: 'Fine moulding texture that broadens the highlight into a lobe.',
        },
      ],
      roughness: {
        base: 0.6,
        map: '/media/flacon/satinCharcoal/satincharcoal_roughness.png',
        source: 'reference-pixel-extraction, independent of the albedo map',
      },
      metalness: 0.0,
      normal: { map: '/media/flacon/satinCharcoal/satincharcoal_normal.png', scale: 0.6 },
      bump: {
        pattern: 'reference-derived height field',
        amplitude: 0.014,
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_height.png',
          url: '/media/flacon/satinCharcoal/satincharcoal_height.png',
          channel: 'height',
          source: 'reference-pixel-extraction',
        },
      },
      displacement: { pattern: 'none', amplitude: 0.0, scale: 1.0, silhouetteAffects: false },
      ambientOcclusion: {
        map: '/media/flacon/satinCharcoal/satincharcoal_ao.png',
        intensity: 0.8,
        source: 'reference-pixel-extraction, independent of the albedo and roughness maps',
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: '#2F2A22' },
      localOverrides: [
        {
          id: 'grooveShadow',
          target: 'cap.localFeatures.machinedGroove',
          channel: 'ao',
          note: 'Occlusion inside the two grooves; the grooves themselves are geometry.',
        },
        {
          id: 'reference-pbr-pixel-evidence',
          type: 'material-map-evidence',
          evidenceRefs: ['full-object'],
          channels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
          notes:
            'Use generated maps as material evidence, then refine after browser screenshot comparison.',
        },
      ],
      shaderNotes: [
        'Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.',
        'Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.',
        'Use normal/bump/displacement only when they map to observed surface relief.',
        'Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.',
        'Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.',
        'Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps.',
      ],
      notes: 'Replace with image-derived color, roughness, noise, and edge-wear notes.',
      pbr: { metalness: 0.0, roughness: 0.6, specularF0: 0.04 },
      referencePbr: {
        version: '1.0',
        sourceImage:
          '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/cap.png',
        extractor: 'stage1_intake/extract_pbr_evidence.py',
        method: 'single-image pixel evidence with de-lighting estimate; not photogrammetry',
        usable: true,
        verdict: 'pass',
        confidence: 0.86,
        estimatedFidelity: 0.86,
        targetThreshold: 0.7,
        hardLimit:
          'A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.',
        maps: {
          albedo: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_albedo.png',
            url: '/media/flacon/satinCharcoal/satincharcoal_albedo.png',
            channel: 'albedo',
            source: 'reference-pixel-extraction',
          },
          roughness: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_roughness.png',
            url: '/media/flacon/satinCharcoal/satincharcoal_roughness.png',
            channel: 'roughness',
            source: 'reference-pixel-extraction',
          },
          height: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_height.png',
            url: '/media/flacon/satinCharcoal/satincharcoal_height.png',
            channel: 'height',
            source: 'reference-pixel-extraction',
          },
          normal: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_normal.png',
            url: '/media/flacon/satinCharcoal/satincharcoal_normal.png',
            channel: 'normal',
            source: 'reference-pixel-extraction',
          },
          ao: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/satinCharcoal/satincharcoal_ao.png',
            url: '/media/flacon/satinCharcoal/satincharcoal_ao.png',
            channel: 'ao',
            source: 'reference-pixel-extraction',
          },
        },
        diagnostics: {
          sourceWidth: 210,
          sourceHeight: 150,
          mapSize: 1024,
          cropBBoxPixels: { x: 0, y: 0, width: 210, height: 150 },
          mask: {
            backgroundColor: '#1D2325',
            backgroundNoise: 13.379,
            transparentPixelFraction: 0.0,
            foregroundCoverage: 0.8338,
          },
          mapStats: {
            valueRange: 0.4935,
            heightP90Gradient: 0.03058,
            roughnessBase: 0.7,
            roughnessVariation: 0.05,
            normalStrength: 0.192,
            blurRadius: 21,
          },
          palette: ['#414345', '#0D1112', '#1E2225', '#5F6164', '#8F9093'],
        },
        warnings: [
          'single-image inverse rendering cannot prove true physical PBR; confidence is capped',
        ],
      },
    },
    options,
  );
  materialMap['labelPaper'] = createSculptMaterial(
    'labelPaper',
    {
      id: 'labelPaper',
      name: 'Label paper',
      type: 'standard',
      shaderModel: 'MeshStandardMaterial',
      baseColor: '#d8d3c8',
      color: '#d8d3c8',
      albedo: {
        dominant: '#B1AAA2',
        secondary: ['#ACA59C', '#66502C', '#4E4025'],
        samplingNotes:
          'Reference-derived from foreground pixels; de-lit to reduce baked shadows/highlights.',
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_albedo.png',
          url: '/media/flacon/labelPaper/labelpaper_albedo.png',
          channel: 'albedo',
          source: 'reference-pixel-extraction',
        },
      },
      colorVariation: {
        palette: ['#B1AAA2', '#ACA59C', '#66502C', '#4E4025', '#D4CBC1'],
        pattern: 'reference-derived pixel palette',
        amplitude: 0.17,
        heightCorrelation: 0.42,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: 'uv',
        repeat: [2.0, 2.0],
        anisotropy: 8,
        texelDensityIntent:
          'Preserve stable world/object-scale detail; do not stretch micro detail with component scale.',
      },
      surfaceFrequencyBands: [
        { id: 'macro', frequency: 1.0, amplitude: 0.0004, note: 'Flat applied rectangle.' },
        { id: 'meso', frequency: 7.0, amplitude: 0.0004, note: 'Slight lift at the label edges.' },
        { id: 'micro', frequency: 330.0, amplitude: 0.003, note: 'Paper fibre grain.' },
      ],
      roughness: {
        base: 0.88,
        map: '/media/flacon/labelPaper/labelpaper_roughness.png',
        source: 'reference-pixel-extraction, independent of the albedo map',
      },
      metalness: 0.0,
      normal: { map: '/media/flacon/labelPaper/labelpaper_normal.png', scale: 0.6 },
      bump: {
        pattern: 'reference-derived height field',
        amplitude: 0.01,
        map: {
          path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_height.png',
          url: '/media/flacon/labelPaper/labelpaper_height.png',
          channel: 'height',
          source: 'reference-pixel-extraction',
        },
      },
      displacement: { pattern: 'none', amplitude: 0.0, scale: 1.0, silhouetteAffects: false },
      ambientOcclusion: {
        map: '/media/flacon/labelPaper/labelpaper_ao.png',
        intensity: 0.8,
        source: 'reference-pixel-extraction, independent of the albedo and roughness maps',
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: '#2F2A22' },
      localOverrides: [
        {
          id: 'reference-pbr-pixel-evidence',
          type: 'material-map-evidence',
          evidenceRefs: ['full-object'],
          channels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
          notes:
            'Use generated maps as material evidence, then refine after browser screenshot comparison.',
        },
      ],
      shaderNotes: [
        'Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.',
        'Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.',
        'Use normal/bump/displacement only when they map to observed surface relief.',
        'Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there.',
        'Reference-derived maps are estimates from image pixels; verify with neutral, grazing, and reference-matched renders.',
        'Do not treat baked image shadows as final albedo; rerun extraction with a tighter material crop if highlights/shadows pollute the maps.',
      ],
      notes: 'Replace with image-derived color, roughness, noise, and edge-wear notes.',
      pbr: { metalness: 0.0, roughness: 0.88, specularF0: 0.04 },
      referencePbr: {
        version: '1.0',
        sourceImage:
          '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/label.png',
        extractor: 'stage1_intake/extract_pbr_evidence.py',
        method: 'single-image pixel evidence with de-lighting estimate; not photogrammetry',
        usable: true,
        verdict: 'pass',
        confidence: 0.81,
        estimatedFidelity: 0.81,
        targetThreshold: 0.7,
        hardLimit:
          'A single image cannot uniquely recover true albedo/roughness/normal/AO; maps are reference-derived estimates.',
        maps: {
          albedo: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_albedo.png',
            url: '/media/flacon/labelPaper/labelpaper_albedo.png',
            channel: 'albedo',
            source: 'reference-pixel-extraction',
          },
          roughness: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_roughness.png',
            url: '/media/flacon/labelPaper/labelpaper_roughness.png',
            channel: 'roughness',
            source: 'reference-pixel-extraction',
          },
          height: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_height.png',
            url: '/media/flacon/labelPaper/labelpaper_height.png',
            channel: 'height',
            source: 'reference-pixel-extraction',
          },
          normal: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_normal.png',
            url: '/media/flacon/labelPaper/labelpaper_normal.png',
            channel: 'normal',
            source: 'reference-pixel-extraction',
          },
          ao: {
            path: '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/pbr/labelPaper/labelpaper_ao.png',
            url: '/media/flacon/labelPaper/labelpaper_ao.png',
            channel: 'ao',
            source: 'reference-pixel-extraction',
          },
        },
        diagnostics: {
          sourceWidth: 210,
          sourceHeight: 90,
          mapSize: 1024,
          cropBBoxPixels: { x: 0, y: 0, width: 210, height: 90 },
          mask: {
            backgroundColor: '#504127',
            backgroundNoise: 22.913,
            transparentPixelFraction: 0.0,
            foregroundCoverage: 1.0,
          },
          mapStats: {
            valueRange: 0.4046,
            heightP90Gradient: 0.02125,
            roughnessBase: 0.695,
            roughnessVariation: 0.05,
            normalStrength: 0.181,
            blurRadius: 21,
          },
          palette: ['#B1AAA2', '#ACA59C', '#66502C', '#4E4025', '#D4CBC1'],
        },
        warnings: [
          'image is not clearly isolated from background; using most pixels as material evidence',
          'object/background separation is weak',
          'single-image inverse rendering cannot prove true physical PBR; confidence is capped',
        ],
      },
    },
    options,
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_root_0 = makeAttachmentEndpoint(null);
  const node_root_0 = new THREE.Group();
  node_root_0.name = 'Packaged unit__pivot';
  node_root_0.scale.set(1, 1, 1);
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_root_0.userData.sculptComponent = {
    id: 'root',
    name: 'Packaged unit',
    level: 'macro',
    role: 'assembly',
    importance: 1.0,
    confidence: 0.95,
    primitive: 'box',
    topologyClass: 'assembled-solid',
    topologyRationale:
      'A closure assembly of discrete manufactured parts, not one continuous surface: each part is separately moulded or turned and meets its neighbour at a real seam, so separate geometry per part is correct.',
    geometryDescriptor: {
      topologyIntent: 'low-poly blockout with bevel-ready edges',
      edgeTreatment: { type: 'none', bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: 'generated procedural coordinates',
      normalStrategy: 'vertex normals from generated geometry',
    },
    parent: null,
    attachment: null,
    dimensions: { width: 1.0, height: 1.0, depth: 1.0, units: 'relative', confidence: 0.5 },
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'root',
      pivot: { mode: 'explicit', position: [0, 0, 0], confidence: 1.0 },
      transformChannels: { translate: true, rotate: true, scale: false },
      collider: { type: 'box', size: [1.11, 1.685, 0.53], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'glass',
    materialLayers: [],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(24, 28, 30, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.6,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_root_0.userData.actionProfile = {
    animationRole: 'root',
    pivot: { mode: 'explicit', position: [0, 0, 0], confidence: 1.0 },
    transformChannels: { translate: true, rotate: true, scale: false },
    collider: { type: 'box', size: [1.11, 1.685, 0.53], isTrigger: false },
    constraints: [],
    destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
  };
  (nodes['root'] ?? root).add(node_root_0);
  nodes['root'] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(
        endpoint_root_0.endRadius,
        endpoint_root_0.baseRadius,
        endpoint_root_0.length,
        16,
        6,
      )
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap['glass'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_root_0.name = 'Packaged unit';
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {
    id: 'root',
    name: 'Packaged unit',
    level: 'macro',
    role: 'assembly',
    importance: 1.0,
    confidence: 0.95,
    primitive: 'box',
    topologyClass: 'assembled-solid',
    topologyRationale:
      'A closure assembly of discrete manufactured parts, not one continuous surface: each part is separately moulded or turned and meets its neighbour at a real seam, so separate geometry per part is correct.',
    geometryDescriptor: {
      topologyIntent: 'low-poly blockout with bevel-ready edges',
      edgeTreatment: { type: 'none', bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: 'generated procedural coordinates',
      normalStrategy: 'vertex normals from generated geometry',
    },
    parent: null,
    attachment: null,
    dimensions: { width: 1.0, height: 1.0, depth: 1.0, units: 'relative', confidence: 0.5 },
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'root',
      pivot: { mode: 'explicit', position: [0, 0, 0], confidence: 1.0 },
      transformChannels: { translate: true, rotate: true, scale: false },
      collider: { type: 'box', size: [1.11, 1.685, 0.53], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'glass',
    materialLayers: [],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(24, 28, 30, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.6,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_root_0.add(mesh_root_0);
  meshes['root'] = mesh_root_0;
  colliders['root'] = { type: 'box', size: [1.11, 1.685, 0.53], isTrigger: false };

  const endpoint_bottleBody_1 = makeAttachmentEndpoint(null);
  const node_bottleBody_1 = new THREE.Group();
  node_bottleBody_1.name = 'Glass body__pivot';
  node_bottleBody_1.scale.set(1, 1, 1);
  if (endpoint_bottleBody_1) {
    node_bottleBody_1.position.copy(endpoint_bottleBody_1.start);
    node_bottleBody_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_bottleBody_1.position.set(0.0, 0.59, 0.0);
    node_bottleBody_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_bottleBody_1.userData.sculptComponent = {
    id: 'bottleBody',
    name: 'Glass body',
    level: 'macro',
    role: 'body',
    importance: 1.0,
    confidence: 0.9,
    primitive: 'extrude',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'One press-moulded glass blank: the faces, fillets, shoulder bevel and base slab are one continuous surface, so a single filleted box with a bevelled top is correct rather than assembled panels.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'root',
    attachment: null,
    dimensions: { width: 1.0, height: 1.18, depth: 0.42 },
    transform: { position: [0, 0.59, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'base-centre', position: [0, -0.59, 0], confidence: 0.95 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'box', size: [1.0, 1.18, 0.42], isTrigger: false },
      constraints: [],
      destruction: { breakable: true, breakImpulse: 6.0, mode: 'shatter' },
      sockets: [
        { id: 'bottleBody.interior', position: [0, 0.0, 0] },
        { id: 'bottleBody.neck', position: [0, 0.65, 0] },
        { id: 'bottleBody.frontFace', position: [0, -0.24, 0.21] },
      ],
    },
    material: 'glass',
    materialLayers: ['glass'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'baseSlab',
        kind: 'internal-boundary',
        description:
          'Solid unfilled glass foot occupying the lower 0.17 of body height, with a visible horizontal internal boundary against the juice above.',
        evidenceRef: 'zones/zone-r2c1.png',
        confidence: 0.93,
      },
      {
        id: 'shoulderBevel',
        kind: 'geometry',
        description: 'Short flat step inward at the top face before the neck; flat, not filleted.',
        evidenceRef: 'zones/zone-r1c0.png',
        confidence: 0.85,
      },
      {
        id: 'baseRound',
        kind: 'geometry',
        description: 'Large horizontal round where the base meets the ground plane.',
        evidenceRef: 'zones/zone-r2c0.png',
        confidence: 0.86,
      },
      {
        id: 'cornerFillet',
        kind: 'geometry',
        description: 'Constant-radius vertical round, 0.055 body widths, full body height.',
        evidenceRef: 'zones/zone-r1c2.png',
        confidence: 0.87,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'glass',
    colorMaterialRecipe: {
      componentId: 'bottleBody',
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(75, 57, 31, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.6,
      roughnessEstimate: 0.127,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/bottleBody.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.469 },
    },
  };
  node_bottleBody_1.userData.actionProfile = {
    animationRole: 'static',
    pivot: { mode: 'base-centre', position: [0, -0.59, 0], confidence: 0.95 },
    transformChannels: { translate: true, rotate: false, scale: false },
    collider: { type: 'box', size: [1.0, 1.18, 0.42], isTrigger: false },
    constraints: [],
    destruction: { breakable: true, breakImpulse: 6.0, mode: 'shatter' },
    sockets: [
      { id: 'bottleBody.interior', position: [0, 0.0, 0] },
      { id: 'bottleBody.neck', position: [0, 0.65, 0] },
      { id: 'bottleBody.frontFace', position: [0, -0.24, 0.21] },
    ],
  };
  (nodes['root'] ?? root).add(node_bottleBody_1);
  nodes['bottleBody'] = node_bottleBody_1;
  const mesh_bottleBody_1Geometry = endpoint_bottleBody_1
    ? new THREE.CylinderGeometry(
        endpoint_bottleBody_1.endRadius,
        endpoint_bottleBody_1.baseRadius,
        endpoint_bottleBody_1.length,
        16,
        6,
      )
    : buildExtrudeGeometry({
        points: [
          [-0.3, -0.3],
          [0.3, -0.3],
          [0.3, 0.3],
          [-0.3, 0.3],
        ],
        depth: 0.1,
      });
  if (!endpoint_bottleBody_1) {
    mesh_bottleBody_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_bottleBody_1 = new THREE.Mesh(
    mesh_bottleBody_1Geometry,
    materialMap['glass'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_bottleBody_1.name = 'Glass body';
  if (endpoint_bottleBody_1) {
    mesh_bottleBody_1.position.copy(endpoint_bottleBody_1.midpoint);
    mesh_bottleBody_1.quaternion.copy(endpoint_bottleBody_1.quaternion);
  }
  mesh_bottleBody_1.castShadow = options.castShadow ?? true;
  mesh_bottleBody_1.receiveShadow = options.receiveShadow ?? true;
  mesh_bottleBody_1.userData.sculptComponent = {
    id: 'bottleBody',
    name: 'Glass body',
    level: 'macro',
    role: 'body',
    importance: 1.0,
    confidence: 0.9,
    primitive: 'extrude',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'One press-moulded glass blank: the faces, fillets, shoulder bevel and base slab are one continuous surface, so a single filleted box with a bevelled top is correct rather than assembled panels.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'root',
    attachment: null,
    dimensions: { width: 1.0, height: 1.18, depth: 0.42 },
    transform: { position: [0, 0.59, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'base-centre', position: [0, -0.59, 0], confidence: 0.95 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'box', size: [1.0, 1.18, 0.42], isTrigger: false },
      constraints: [],
      destruction: { breakable: true, breakImpulse: 6.0, mode: 'shatter' },
      sockets: [
        { id: 'bottleBody.interior', position: [0, 0.0, 0] },
        { id: 'bottleBody.neck', position: [0, 0.65, 0] },
        { id: 'bottleBody.frontFace', position: [0, -0.24, 0.21] },
      ],
    },
    material: 'glass',
    materialLayers: ['glass'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'baseSlab',
        kind: 'internal-boundary',
        description:
          'Solid unfilled glass foot occupying the lower 0.17 of body height, with a visible horizontal internal boundary against the juice above.',
        evidenceRef: 'zones/zone-r2c1.png',
        confidence: 0.93,
      },
      {
        id: 'shoulderBevel',
        kind: 'geometry',
        description: 'Short flat step inward at the top face before the neck; flat, not filleted.',
        evidenceRef: 'zones/zone-r1c0.png',
        confidence: 0.85,
      },
      {
        id: 'baseRound',
        kind: 'geometry',
        description: 'Large horizontal round where the base meets the ground plane.',
        evidenceRef: 'zones/zone-r2c0.png',
        confidence: 0.86,
      },
      {
        id: 'cornerFillet',
        kind: 'geometry',
        description: 'Constant-radius vertical round, 0.055 body widths, full body height.',
        evidenceRef: 'zones/zone-r1c2.png',
        confidence: 0.87,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'glass',
    colorMaterialRecipe: {
      componentId: 'bottleBody',
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(75, 57, 31, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.6,
      roughnessEstimate: 0.127,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/bottleBody.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.469 },
    },
  };
  node_bottleBody_1.add(mesh_bottleBody_1);
  meshes['bottleBody'] = mesh_bottleBody_1;
  colliders['bottleBody'] = { type: 'box', size: [1.0, 1.18, 0.42], isTrigger: false };
  const socket_bottleBody_bottleBody_interior_0 = new THREE.Object3D();
  socket_bottleBody_bottleBody_interior_0.name = 'bottleBody.interior';
  socket_bottleBody_bottleBody_interior_0.position.set(0.0, 0.0, 0.0);
  socket_bottleBody_bottleBody_interior_0.rotation.set(0, 0, 0);
  socket_bottleBody_bottleBody_interior_0.userData.socket = {
    id: 'bottleBody.interior',
    position: [0, 0.0, 0],
  };
  node_bottleBody_1.add(socket_bottleBody_bottleBody_interior_0);
  sockets['bottleBody:bottleBody.interior'] = socket_bottleBody_bottleBody_interior_0;
  const socket_bottleBody_bottleBody_neck_1 = new THREE.Object3D();
  socket_bottleBody_bottleBody_neck_1.name = 'bottleBody.neck';
  socket_bottleBody_bottleBody_neck_1.position.set(0.0, 0.65, 0.0);
  socket_bottleBody_bottleBody_neck_1.rotation.set(0, 0, 0);
  socket_bottleBody_bottleBody_neck_1.userData.socket = {
    id: 'bottleBody.neck',
    position: [0, 0.65, 0],
  };
  node_bottleBody_1.add(socket_bottleBody_bottleBody_neck_1);
  sockets['bottleBody:bottleBody.neck'] = socket_bottleBody_bottleBody_neck_1;
  const socket_bottleBody_bottleBody_frontFace_2 = new THREE.Object3D();
  socket_bottleBody_bottleBody_frontFace_2.name = 'bottleBody.frontFace';
  socket_bottleBody_bottleBody_frontFace_2.position.set(0.0, -0.24, 0.21);
  socket_bottleBody_bottleBody_frontFace_2.rotation.set(0, 0, 0);
  socket_bottleBody_bottleBody_frontFace_2.userData.socket = {
    id: 'bottleBody.frontFace',
    position: [0, -0.24, 0.21],
  };
  node_bottleBody_1.add(socket_bottleBody_bottleBody_frontFace_2);
  sockets['bottleBody:bottleBody.frontFace'] = socket_bottleBody_bottleBody_frontFace_2;

  const endpoint_juice_2 = makeAttachmentEndpoint(null);
  const node_juice_2 = new THREE.Group();
  node_juice_2.name = 'Juice volume__pivot';
  node_juice_2.scale.set(1, 1, 1);
  if (endpoint_juice_2) {
    node_juice_2.position.copy(endpoint_juice_2.start);
    node_juice_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_juice_2.position.set(0.0, -0.075, 0.0);
    node_juice_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_juice_2.userData.sculptComponent = {
    id: 'juice',
    name: 'Juice volume',
    level: 'macro',
    role: 'content',
    importance: 0.9,
    confidence: 0.88,
    primitive: 'extrude',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'A liquid volume takes the shape of its container interior; one inset filleted box with a flat top face is exactly that, and the flat top is the meniscus.',
    geometryDescriptor: {
      topologyIntent: 'inset from the inner wall by the glass thickness, flat top at the meniscus',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.03, segments: 4 },
      deformationStack: [],
      uvStrategy: 'box projection',
      normalStrategy: 'smooth on fillets, flat on the meniscus',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.interior',
      localStart: [0, 0.2, 0],
      localEnd: [0, 0.944, 0],
      contactType: 'embed',
      embedDepth: 0.05,
      gapTolerance: 0.0,
    },
    dimensions: { width: 0.9, height: 0.744, depth: 0.32 },
    transform: { position: [0, -0.075, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'explode-tier-1',
      pivot: { mode: 'volume-centre', position: [0, 0, 0], confidence: 0.9 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'juice',
    materialLayers: ['juice'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'meniscus',
        kind: 'boundary',
        description:
          'Hard horizontal liquid boundary at 0.8 of body height, crisp against the inner wall.',
        evidenceRef: 'zones/zone-r1c1.png',
        confidence: 0.92,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'juice',
    colorMaterialRecipe: {
      componentId: 'juice',
      dominantAlbedo: 'rgba(95, 72, 37, 1.0)',
      secondaryAlbedo: 'rgba(117, 88, 47, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.6,
      roughnessEstimate: 0.132,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/juice.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.368 },
    },
  };
  node_juice_2.userData.actionProfile = {
    animationRole: 'explode-tier-1',
    pivot: { mode: 'volume-centre', position: [0, 0, 0], confidence: 0.9 },
    transformChannels: { translate: true, rotate: false, scale: false },
    collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
    constraints: [],
    destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
  };
  (nodes['bottleBody'] ?? root).add(node_juice_2);
  nodes['juice'] = node_juice_2;
  const mesh_juice_2Geometry = endpoint_juice_2
    ? new THREE.CylinderGeometry(
        endpoint_juice_2.endRadius,
        endpoint_juice_2.baseRadius,
        endpoint_juice_2.length,
        16,
        6,
      )
    : buildExtrudeGeometry({
        points: [
          [-0.3, -0.3],
          [0.3, -0.3],
          [0.3, 0.3],
          [-0.3, 0.3],
        ],
        depth: 0.1,
      });
  if (!endpoint_juice_2) {
    mesh_juice_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_juice_2 = new THREE.Mesh(
    mesh_juice_2Geometry,
    materialMap['juice'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_juice_2.name = 'Juice volume';
  if (endpoint_juice_2) {
    mesh_juice_2.position.copy(endpoint_juice_2.midpoint);
    mesh_juice_2.quaternion.copy(endpoint_juice_2.quaternion);
  }
  mesh_juice_2.castShadow = options.castShadow ?? true;
  mesh_juice_2.receiveShadow = options.receiveShadow ?? true;
  mesh_juice_2.userData.sculptComponent = {
    id: 'juice',
    name: 'Juice volume',
    level: 'macro',
    role: 'content',
    importance: 0.9,
    confidence: 0.88,
    primitive: 'extrude',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'A liquid volume takes the shape of its container interior; one inset filleted box with a flat top face is exactly that, and the flat top is the meniscus.',
    geometryDescriptor: {
      topologyIntent: 'inset from the inner wall by the glass thickness, flat top at the meniscus',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.03, segments: 4 },
      deformationStack: [],
      uvStrategy: 'box projection',
      normalStrategy: 'smooth on fillets, flat on the meniscus',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.interior',
      localStart: [0, 0.2, 0],
      localEnd: [0, 0.944, 0],
      contactType: 'embed',
      embedDepth: 0.05,
      gapTolerance: 0.0,
    },
    dimensions: { width: 0.9, height: 0.744, depth: 0.32 },
    transform: { position: [0, -0.075, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'explode-tier-1',
      pivot: { mode: 'volume-centre', position: [0, 0, 0], confidence: 0.9 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'juice',
    materialLayers: ['juice'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'meniscus',
        kind: 'boundary',
        description:
          'Hard horizontal liquid boundary at 0.8 of body height, crisp against the inner wall.',
        evidenceRef: 'zones/zone-r1c1.png',
        confidence: 0.92,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'juice',
    colorMaterialRecipe: {
      componentId: 'juice',
      dominantAlbedo: 'rgba(95, 72, 37, 1.0)',
      secondaryAlbedo: 'rgba(117, 88, 47, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.6,
      roughnessEstimate: 0.132,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/juice.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.368 },
    },
  };
  node_juice_2.add(mesh_juice_2);
  meshes['juice'] = mesh_juice_2;
  colliders['juice'] = { type: 'none', size: [0, 0, 0], isTrigger: false };

  const endpoint_collar_3 = makeAttachmentEndpoint(null);
  const node_collar_3 = new THREE.Group();
  node_collar_3.name = 'Brushed metal collar__pivot';
  node_collar_3.scale.set(1, 1, 1);
  if (endpoint_collar_3) {
    node_collar_3.position.copy(endpoint_collar_3.start);
    node_collar_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_collar_3.position.set(0.0, 1.305, 0.0);
    node_collar_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_collar_3.userData.sculptComponent = {
    id: 'collar',
    name: 'Brushed metal collar',
    level: 'macro',
    role: 'hardware',
    importance: 0.8,
    confidence: 0.88,
    primitive: 'lathe',
    topologyClass: 'continuous-sculpt',
    topologyRationale: 'A turned metal sleeve: one revolved profile, no assembled panels.',
    geometryDescriptor: {
      topologyIntent: 'revolved sleeve, 48 radial segments so the silhouette reads round',
      edgeTreatment: { type: 'chamfer', bevelRadius: 0.008, segments: 2 },
      deformationStack: [],
      uvStrategy: 'cylindrical, V along the axis so axial brushing runs the right way',
      normalStrategy: 'smooth around the axis, flat on the rims',
    },
    parent: 'root',
    attachment: {
      parentSocket: 'bottleBody.neck',
      localStart: [0, 1.24, 0],
      localEnd: [0, 1.37, 0],
      contactType: 'socket',
      embedDepth: 0.04,
      gapTolerance: 0.0,
    },
    dimensions: { radius: 0.22, height: 0.13 },
    transform: { position: [0, 1.305, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'explode-tier-3',
      pivot: { mode: 'lower-rim', position: [0, -0.065, 0], confidence: 0.92 },
      transformChannels: { translate: true, rotate: true, scale: false },
      collider: { type: 'cylinder', size: [0.22, 0.13, 0.22], isTrigger: false },
      constraints: [],
      destruction: { breakable: true, breakImpulse: 12.0, mode: 'detach' },
      sockets: [{ id: 'collar.topRim', position: [0, 0.065, 0] }],
    },
    material: 'brushedGold',
    materialLayers: ['brushedGold'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'brushedGold',
    colorMaterialRecipe: {
      componentId: 'collar',
      dominantAlbedo: 'rgba(227, 214, 199, 1.0)',
      secondaryAlbedo: 'rgba(56, 49, 37, 1.0)',
      materialClass: 'metal',
      materialClassConfidence: 0.75,
      roughnessEstimate: 0.323,
      metalnessEstimate: 1.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/collar.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.391 },
    },
  };
  node_collar_3.userData.actionProfile = {
    animationRole: 'explode-tier-3',
    pivot: { mode: 'lower-rim', position: [0, -0.065, 0], confidence: 0.92 },
    transformChannels: { translate: true, rotate: true, scale: false },
    collider: { type: 'cylinder', size: [0.22, 0.13, 0.22], isTrigger: false },
    constraints: [],
    destruction: { breakable: true, breakImpulse: 12.0, mode: 'detach' },
    sockets: [{ id: 'collar.topRim', position: [0, 0.065, 0] }],
  };
  (nodes['root'] ?? root).add(node_collar_3);
  nodes['collar'] = node_collar_3;
  const mesh_collar_3Geometry = endpoint_collar_3
    ? new THREE.CylinderGeometry(
        endpoint_collar_3.endRadius,
        endpoint_collar_3.baseRadius,
        endpoint_collar_3.length,
        16,
        6,
      )
    : buildLatheGeometry({
        points: [
          [0.3, -0.5],
          [0.15, 0.0],
          [0.3, 0.5],
        ],
        segments: 24,
      });
  if (!endpoint_collar_3) {
    mesh_collar_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_collar_3 = new THREE.Mesh(
    mesh_collar_3Geometry,
    materialMap['brushedGold'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_collar_3.name = 'Brushed metal collar';
  if (endpoint_collar_3) {
    mesh_collar_3.position.copy(endpoint_collar_3.midpoint);
    mesh_collar_3.quaternion.copy(endpoint_collar_3.quaternion);
  }
  mesh_collar_3.castShadow = options.castShadow ?? true;
  mesh_collar_3.receiveShadow = options.receiveShadow ?? true;
  mesh_collar_3.userData.sculptComponent = {
    id: 'collar',
    name: 'Brushed metal collar',
    level: 'macro',
    role: 'hardware',
    importance: 0.8,
    confidence: 0.88,
    primitive: 'lathe',
    topologyClass: 'continuous-sculpt',
    topologyRationale: 'A turned metal sleeve: one revolved profile, no assembled panels.',
    geometryDescriptor: {
      topologyIntent: 'revolved sleeve, 48 radial segments so the silhouette reads round',
      edgeTreatment: { type: 'chamfer', bevelRadius: 0.008, segments: 2 },
      deformationStack: [],
      uvStrategy: 'cylindrical, V along the axis so axial brushing runs the right way',
      normalStrategy: 'smooth around the axis, flat on the rims',
    },
    parent: 'root',
    attachment: {
      parentSocket: 'bottleBody.neck',
      localStart: [0, 1.24, 0],
      localEnd: [0, 1.37, 0],
      contactType: 'socket',
      embedDepth: 0.04,
      gapTolerance: 0.0,
    },
    dimensions: { radius: 0.22, height: 0.13 },
    transform: { position: [0, 1.305, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'explode-tier-3',
      pivot: { mode: 'lower-rim', position: [0, -0.065, 0], confidence: 0.92 },
      transformChannels: { translate: true, rotate: true, scale: false },
      collider: { type: 'cylinder', size: [0.22, 0.13, 0.22], isTrigger: false },
      constraints: [],
      destruction: { breakable: true, breakImpulse: 12.0, mode: 'detach' },
      sockets: [{ id: 'collar.topRim', position: [0, 0.065, 0] }],
    },
    material: 'brushedGold',
    materialLayers: ['brushedGold'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'brushedGold',
    colorMaterialRecipe: {
      componentId: 'collar',
      dominantAlbedo: 'rgba(227, 214, 199, 1.0)',
      secondaryAlbedo: 'rgba(56, 49, 37, 1.0)',
      materialClass: 'metal',
      materialClassConfidence: 0.75,
      roughnessEstimate: 0.323,
      metalnessEstimate: 1.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/collar.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.391 },
    },
  };
  node_collar_3.add(mesh_collar_3);
  meshes['collar'] = mesh_collar_3;
  colliders['collar'] = { type: 'cylinder', size: [0.22, 0.13, 0.22], isTrigger: false };
  const socket_collar_collar_topRim_0 = new THREE.Object3D();
  socket_collar_collar_topRim_0.name = 'collar.topRim';
  socket_collar_collar_topRim_0.position.set(0.0, 0.065, 0.0);
  socket_collar_collar_topRim_0.rotation.set(0, 0, 0);
  socket_collar_collar_topRim_0.userData.socket = { id: 'collar.topRim', position: [0, 0.065, 0] };
  node_collar_3.add(socket_collar_collar_topRim_0);
  sockets['collar:collar.topRim'] = socket_collar_collar_topRim_0;

  const endpoint_cap_4 = makeAttachmentEndpoint(null);
  const node_cap_4 = new THREE.Group();
  node_cap_4.name = 'Satin overcap__pivot';
  node_cap_4.scale.set(1, 1, 1);
  if (endpoint_cap_4) {
    node_cap_4.position.copy(endpoint_cap_4.start);
    node_cap_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_cap_4.position.set(0.0, 1.5275, 0.0);
    node_cap_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_cap_4.userData.sculptComponent = {
    id: 'cap',
    name: 'Satin overcap',
    level: 'macro',
    role: 'closure',
    importance: 0.85,
    confidence: 0.9,
    primitive: 'lathe',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'One moulded polymer cylinder with a rounded top and two turned grooves; the grooves are recessed geometry, not a texture, because they catch light on their own edges.',
    geometryDescriptor: {
      topologyIntent:
        'revolved profile with a generous top round and two recessed grooves near the lower edge; 48 radial segments',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.021, segments: 4 },
      deformationStack: [],
      uvStrategy: 'cylindrical',
      normalStrategy: 'smooth around the axis, split at the groove shoulders',
    },
    parent: 'root',
    attachment: {
      parentSocket: 'collar.topRim',
      localStart: [0, 1.37, 0],
      localEnd: [0, 1.685, 0],
      contactType: 'butt',
      embedDepth: 0.0,
      gapTolerance: 0.004,
    },
    dimensions: { radius: 0.21, height: 0.315 },
    transform: { position: [0, 1.5275, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'explode-tier-3',
      pivot: { mode: 'lower-face', position: [0, -0.1575, 0], confidence: 0.93 },
      transformChannels: { translate: true, rotate: true, scale: false },
      collider: { type: 'cylinder', size: [0.21, 0.315, 0.21], isTrigger: false },
      constraints: [],
      destruction: { breakable: true, breakImpulse: 10.0, mode: 'detach' },
      sockets: [{ id: 'cap.wall', position: [0, -0.115, 0.21] }],
    },
    material: 'satinCharcoal',
    materialLayers: ['satinCharcoal'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'machinedGroove',
        kind: 'relief',
        description:
          'TWO fine recessed circumferential grooves close together near the lower edge, each about 0.006 body widths deep. Corrected from the first-pass reading of one groove.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
      {
        id: 'capTopRound',
        kind: 'geometry',
        description:
          'Generous round on the top edge, about a tenth of the cap radius. Corrected from the first-pass reading of a slight chamfer.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'satinCharcoal',
    colorMaterialRecipe: {
      componentId: 'cap',
      dominantAlbedo: 'rgba(24, 28, 30, 1.0)',
      secondaryAlbedo: 'rgba(71, 73, 76, 1.0)',
      materialClass: 'plastic',
      materialClassConfidence: 0.6,
      roughnessEstimate: 0.131,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/cap.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.464 },
    },
  };
  node_cap_4.userData.actionProfile = {
    animationRole: 'explode-tier-3',
    pivot: { mode: 'lower-face', position: [0, -0.1575, 0], confidence: 0.93 },
    transformChannels: { translate: true, rotate: true, scale: false },
    collider: { type: 'cylinder', size: [0.21, 0.315, 0.21], isTrigger: false },
    constraints: [],
    destruction: { breakable: true, breakImpulse: 10.0, mode: 'detach' },
    sockets: [{ id: 'cap.wall', position: [0, -0.115, 0.21] }],
  };
  (nodes['root'] ?? root).add(node_cap_4);
  nodes['cap'] = node_cap_4;
  const mesh_cap_4Geometry = endpoint_cap_4
    ? new THREE.CylinderGeometry(
        endpoint_cap_4.endRadius,
        endpoint_cap_4.baseRadius,
        endpoint_cap_4.length,
        16,
        6,
      )
    : buildLatheGeometry({
        points: [
          [0.3, -0.5],
          [0.15, 0.0],
          [0.3, 0.5],
        ],
        segments: 24,
      });
  if (!endpoint_cap_4) {
    mesh_cap_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_cap_4 = new THREE.Mesh(
    mesh_cap_4Geometry,
    materialMap['satinCharcoal'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_cap_4.name = 'Satin overcap';
  if (endpoint_cap_4) {
    mesh_cap_4.position.copy(endpoint_cap_4.midpoint);
    mesh_cap_4.quaternion.copy(endpoint_cap_4.quaternion);
  }
  mesh_cap_4.castShadow = options.castShadow ?? true;
  mesh_cap_4.receiveShadow = options.receiveShadow ?? true;
  mesh_cap_4.userData.sculptComponent = {
    id: 'cap',
    name: 'Satin overcap',
    level: 'macro',
    role: 'closure',
    importance: 0.85,
    confidence: 0.9,
    primitive: 'lathe',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'One moulded polymer cylinder with a rounded top and two turned grooves; the grooves are recessed geometry, not a texture, because they catch light on their own edges.',
    geometryDescriptor: {
      topologyIntent:
        'revolved profile with a generous top round and two recessed grooves near the lower edge; 48 radial segments',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.021, segments: 4 },
      deformationStack: [],
      uvStrategy: 'cylindrical',
      normalStrategy: 'smooth around the axis, split at the groove shoulders',
    },
    parent: 'root',
    attachment: {
      parentSocket: 'collar.topRim',
      localStart: [0, 1.37, 0],
      localEnd: [0, 1.685, 0],
      contactType: 'butt',
      embedDepth: 0.0,
      gapTolerance: 0.004,
    },
    dimensions: { radius: 0.21, height: 0.315 },
    transform: { position: [0, 1.5275, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'explode-tier-3',
      pivot: { mode: 'lower-face', position: [0, -0.1575, 0], confidence: 0.93 },
      transformChannels: { translate: true, rotate: true, scale: false },
      collider: { type: 'cylinder', size: [0.21, 0.315, 0.21], isTrigger: false },
      constraints: [],
      destruction: { breakable: true, breakImpulse: 10.0, mode: 'detach' },
      sockets: [{ id: 'cap.wall', position: [0, -0.115, 0.21] }],
    },
    material: 'satinCharcoal',
    materialLayers: ['satinCharcoal'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'machinedGroove',
        kind: 'relief',
        description:
          'TWO fine recessed circumferential grooves close together near the lower edge, each about 0.006 body widths deep. Corrected from the first-pass reading of one groove.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
      {
        id: 'capTopRound',
        kind: 'geometry',
        description:
          'Generous round on the top edge, about a tenth of the cap radius. Corrected from the first-pass reading of a slight chamfer.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'satinCharcoal',
    colorMaterialRecipe: {
      componentId: 'cap',
      dominantAlbedo: 'rgba(24, 28, 30, 1.0)',
      secondaryAlbedo: 'rgba(71, 73, 76, 1.0)',
      materialClass: 'plastic',
      materialClassConfidence: 0.6,
      roughnessEstimate: 0.131,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/cap.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.464 },
    },
  };
  node_cap_4.add(mesh_cap_4);
  meshes['cap'] = mesh_cap_4;
  colliders['cap'] = { type: 'cylinder', size: [0.21, 0.315, 0.21], isTrigger: false };
  const socket_cap_cap_wall_0 = new THREE.Object3D();
  socket_cap_cap_wall_0.name = 'cap.wall';
  socket_cap_cap_wall_0.position.set(0.0, -0.115, 0.21);
  socket_cap_cap_wall_0.rotation.set(0, 0, 0);
  socket_cap_cap_wall_0.userData.socket = { id: 'cap.wall', position: [0, -0.115, 0.21] };
  node_cap_4.add(socket_cap_cap_wall_0);
  sockets['cap:cap.wall'] = socket_cap_cap_wall_0;

  const endpoint_label_5 = makeAttachmentEndpoint(null);
  const node_label_5 = new THREE.Group();
  node_label_5.name = 'Front label__pivot';
  node_label_5.scale.set(1, 1, 1);
  if (endpoint_label_5) {
    node_label_5.position.copy(endpoint_label_5.start);
    node_label_5.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_label_5.position.set(0.0, -0.24, 0.212);
    node_label_5.rotation.set(0.0, 0.0, 0.0);
  }
  node_label_5.userData.sculptComponent = {
    id: 'label',
    name: 'Front label',
    level: 'meso',
    role: 'applied-graphic',
    importance: 0.5,
    confidence: 0.95,
    primitive: 'plane-card',
    topologyClass: 'conforming-shell',
    topologyRationale:
      'A thin applied paper rectangle: a shell laid on the parent face, not a solid.',
    geometryDescriptor: {
      topologyIntent: 'thin shell offset 0.002 in front of the body face to avoid z-fighting',
      edgeTreatment: { type: 'none', bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: 'planar',
      normalStrategy: 'flat',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.frontFace',
      localStart: [0, -0.325, 0.21],
      localEnd: [0, -0.155, 0.212],
      contactType: 'overlap',
      embedDepth: 0.0,
      gapTolerance: 0.002,
    },
    dimensions: { width: 0.4, height: 0.17, depth: 0.002 },
    transform: { position: [0, -0.24, 0.212], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.95 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'labelPaper',
    materialLayers: ['labelPaper'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'blankLabel',
        kind: 'graphic',
        description: 'No lettering, no logo. Deliberately blank in the reference and kept blank.',
        evidenceRef: 'zones/zone-r2c1.png',
        confidence: 0.95,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'labelPaper',
    colorMaterialRecipe: {
      componentId: 'label',
      dominantAlbedo: 'rgba(175, 168, 160, 1.0)',
      secondaryAlbedo: 'rgba(98, 77, 43, 1.0)',
      materialClass: 'unknown',
      materialClassConfidence: 0.691,
      roughnessEstimate: 0.124,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/label.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.635 },
    },
  };
  node_label_5.userData.actionProfile = {
    animationRole: 'static',
    pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.95 },
    transformChannels: { translate: true, rotate: false, scale: false },
    collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
    constraints: [],
    destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
  };
  (nodes['bottleBody'] ?? root).add(node_label_5);
  nodes['label'] = node_label_5;
  const mesh_label_5Geometry = endpoint_label_5
    ? new THREE.CylinderGeometry(
        endpoint_label_5.endRadius,
        endpoint_label_5.baseRadius,
        endpoint_label_5.length,
        16,
        6,
      )
    : new THREE.PlaneGeometry(1, 1, 12, 12);
  if (!endpoint_label_5) {
    mesh_label_5Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_label_5 = new THREE.Mesh(
    mesh_label_5Geometry,
    materialMap['labelPaper'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_label_5.name = 'Front label';
  if (endpoint_label_5) {
    mesh_label_5.position.copy(endpoint_label_5.midpoint);
    mesh_label_5.quaternion.copy(endpoint_label_5.quaternion);
  }
  mesh_label_5.castShadow = options.castShadow ?? true;
  mesh_label_5.receiveShadow = options.receiveShadow ?? true;
  mesh_label_5.userData.sculptComponent = {
    id: 'label',
    name: 'Front label',
    level: 'meso',
    role: 'applied-graphic',
    importance: 0.5,
    confidence: 0.95,
    primitive: 'plane-card',
    topologyClass: 'conforming-shell',
    topologyRationale:
      'A thin applied paper rectangle: a shell laid on the parent face, not a solid.',
    geometryDescriptor: {
      topologyIntent: 'thin shell offset 0.002 in front of the body face to avoid z-fighting',
      edgeTreatment: { type: 'none', bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: 'planar',
      normalStrategy: 'flat',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.frontFace',
      localStart: [0, -0.325, 0.21],
      localEnd: [0, -0.155, 0.212],
      contactType: 'overlap',
      embedDepth: 0.0,
      gapTolerance: 0.002,
    },
    dimensions: { width: 0.4, height: 0.17, depth: 0.002 },
    transform: { position: [0, -0.24, 0.212], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.95 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'labelPaper',
    materialLayers: ['labelPaper'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'blankLabel',
        kind: 'graphic',
        description: 'No lettering, no logo. Deliberately blank in the reference and kept blank.',
        evidenceRef: 'zones/zone-r2c1.png',
        confidence: 0.95,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'labelPaper',
    colorMaterialRecipe: {
      componentId: 'label',
      dominantAlbedo: 'rgba(175, 168, 160, 1.0)',
      secondaryAlbedo: 'rgba(98, 77, 43, 1.0)',
      materialClass: 'unknown',
      materialClassConfidence: 0.691,
      roughnessEstimate: 0.124,
      metalnessEstimate: 0.0,
      highlightEvidence: 'sharp, tight specular hotspot — supports low roughness/high specularity',
      sourceCropPath:
        '/Users/radunie/Projects/fragrance_chemistry/apps/web/.img2threejs/crops/label.png',
      labClusterMeta: { clusterCount: 3, dominantClusterSharePct: 0.635 },
    },
  };
  node_label_5.add(mesh_label_5);
  meshes['label'] = mesh_label_5;
  colliders['label'] = { type: 'none', size: [0, 0, 0], isTrigger: false };

  const endpoint_shoulderAssembly_6 = makeAttachmentEndpoint(null);
  const node_shoulderAssembly_6 = new THREE.Group();
  node_shoulderAssembly_6.name = 'Shoulder and neck__pivot';
  node_shoulderAssembly_6.scale.set(1, 1, 1);
  if (endpoint_shoulderAssembly_6) {
    node_shoulderAssembly_6.position.copy(endpoint_shoulderAssembly_6.start);
    node_shoulderAssembly_6.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shoulderAssembly_6.position.set(0.0, 0.59, 0.0);
    node_shoulderAssembly_6.rotation.set(0.0, 0.0, 0.0);
  }
  node_shoulderAssembly_6.userData.sculptComponent = {
    id: 'shoulderAssembly',
    name: 'Shoulder and neck',
    level: 'meso',
    role: 'sub-assembly',
    importance: 0.6,
    confidence: 0.85,
    primitive: 'lathe',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'Continuous with the body blank: the flat inward step and the short neck are one revolved transition, so they are lathed as a profile rather than assembled.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.neck',
      localStart: [0, 1.18, 0],
      localEnd: [0, 1.27, 0],
      contactType: 'butt',
      embedDepth: 0.02,
      gapTolerance: 0.0,
    },
    dimensions: { radius: 0.2, height: 0.09 },
    transform: { position: [0, 0.59, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'glass',
    materialLayers: ['glass'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'shoulderStep',
        kind: 'bevel',
        description: 'Flat inward step, 0.06 body widths wide, before the neck rises.',
        evidenceRef: 'zones/zone-r1c0.png',
        confidence: 0.85,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'glass',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(207, 224, 224, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.8,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_shoulderAssembly_6.userData.actionProfile = {
    animationRole: 'static',
    pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
    transformChannels: { translate: true, rotate: false, scale: false },
    collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
    constraints: [],
    destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
  };
  (nodes['bottleBody'] ?? root).add(node_shoulderAssembly_6);
  nodes['shoulderAssembly'] = node_shoulderAssembly_6;
  const mesh_shoulderAssembly_6Geometry = endpoint_shoulderAssembly_6
    ? new THREE.CylinderGeometry(
        endpoint_shoulderAssembly_6.endRadius,
        endpoint_shoulderAssembly_6.baseRadius,
        endpoint_shoulderAssembly_6.length,
        16,
        6,
      )
    : buildLatheGeometry({
        points: [
          [0.3, -0.5],
          [0.15, 0.0],
          [0.3, 0.5],
        ],
        segments: 24,
      });
  if (!endpoint_shoulderAssembly_6) {
    mesh_shoulderAssembly_6Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_shoulderAssembly_6 = new THREE.Mesh(
    mesh_shoulderAssembly_6Geometry,
    materialMap['glass'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_shoulderAssembly_6.name = 'Shoulder and neck';
  if (endpoint_shoulderAssembly_6) {
    mesh_shoulderAssembly_6.position.copy(endpoint_shoulderAssembly_6.midpoint);
    mesh_shoulderAssembly_6.quaternion.copy(endpoint_shoulderAssembly_6.quaternion);
  }
  mesh_shoulderAssembly_6.castShadow = options.castShadow ?? true;
  mesh_shoulderAssembly_6.receiveShadow = options.receiveShadow ?? true;
  mesh_shoulderAssembly_6.userData.sculptComponent = {
    id: 'shoulderAssembly',
    name: 'Shoulder and neck',
    level: 'meso',
    role: 'sub-assembly',
    importance: 0.6,
    confidence: 0.85,
    primitive: 'lathe',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'Continuous with the body blank: the flat inward step and the short neck are one revolved transition, so they are lathed as a profile rather than assembled.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.neck',
      localStart: [0, 1.18, 0],
      localEnd: [0, 1.27, 0],
      contactType: 'butt',
      embedDepth: 0.02,
      gapTolerance: 0.0,
    },
    dimensions: { radius: 0.2, height: 0.09 },
    transform: { position: [0, 0.59, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'glass',
    materialLayers: ['glass'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'shoulderStep',
        kind: 'bevel',
        description: 'Flat inward step, 0.06 body widths wide, before the neck rises.',
        evidenceRef: 'zones/zone-r1c0.png',
        confidence: 0.85,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'glass',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(207, 224, 224, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.8,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_shoulderAssembly_6.add(mesh_shoulderAssembly_6);
  meshes['shoulderAssembly'] = mesh_shoulderAssembly_6;
  colliders['shoulderAssembly'] = { type: 'none', size: [0, 0, 0], isTrigger: false };

  const endpoint_baseSlabAssembly_7 = makeAttachmentEndpoint(null);
  const node_baseSlabAssembly_7 = new THREE.Group();
  node_baseSlabAssembly_7.name = 'Solid glass foot__pivot';
  node_baseSlabAssembly_7.scale.set(1, 1, 1);
  if (endpoint_baseSlabAssembly_7) {
    node_baseSlabAssembly_7.position.copy(endpoint_baseSlabAssembly_7.start);
    node_baseSlabAssembly_7.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_baseSlabAssembly_7.position.set(0.0, -0.49, 0.0);
    node_baseSlabAssembly_7.rotation.set(0.0, 0.0, 0.0);
  }
  node_baseSlabAssembly_7.userData.sculptComponent = {
    id: 'baseSlabAssembly',
    name: 'Solid glass foot',
    level: 'meso',
    role: 'sub-assembly',
    importance: 0.6,
    confidence: 0.85,
    primitive: 'extrude',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'The foot is the same continuous glass blank, distinguished only by carrying no liquid; it is modelled as part of the body profile with its own internal boundary.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.interior',
      localStart: [0, 0.0, 0],
      localEnd: [0, 0.2, 0],
      contactType: 'embed',
      embedDepth: 0.2,
      gapTolerance: 0.0,
    },
    dimensions: { width: 1.0, height: 0.2, depth: 0.42 },
    transform: { position: [0, -0.49, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'glass',
    materialLayers: ['glass'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'slabBoundary',
        kind: 'contour',
        description: 'Horizontal internal boundary at the top of the solid foot.',
        evidenceRef: 'zones/zone-r2c1.png',
        confidence: 0.93,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'glass',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(207, 224, 224, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.85,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_baseSlabAssembly_7.userData.actionProfile = {
    animationRole: 'static',
    pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
    transformChannels: { translate: true, rotate: false, scale: false },
    collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
    constraints: [],
    destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
  };
  (nodes['bottleBody'] ?? root).add(node_baseSlabAssembly_7);
  nodes['baseSlabAssembly'] = node_baseSlabAssembly_7;
  const mesh_baseSlabAssembly_7Geometry = endpoint_baseSlabAssembly_7
    ? new THREE.CylinderGeometry(
        endpoint_baseSlabAssembly_7.endRadius,
        endpoint_baseSlabAssembly_7.baseRadius,
        endpoint_baseSlabAssembly_7.length,
        16,
        6,
      )
    : buildExtrudeGeometry({
        points: [
          [-0.3, -0.3],
          [0.3, -0.3],
          [0.3, 0.3],
          [-0.3, 0.3],
        ],
        depth: 0.1,
      });
  if (!endpoint_baseSlabAssembly_7) {
    mesh_baseSlabAssembly_7Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_baseSlabAssembly_7 = new THREE.Mesh(
    mesh_baseSlabAssembly_7Geometry,
    materialMap['glass'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_baseSlabAssembly_7.name = 'Solid glass foot';
  if (endpoint_baseSlabAssembly_7) {
    mesh_baseSlabAssembly_7.position.copy(endpoint_baseSlabAssembly_7.midpoint);
    mesh_baseSlabAssembly_7.quaternion.copy(endpoint_baseSlabAssembly_7.quaternion);
  }
  mesh_baseSlabAssembly_7.castShadow = options.castShadow ?? true;
  mesh_baseSlabAssembly_7.receiveShadow = options.receiveShadow ?? true;
  mesh_baseSlabAssembly_7.userData.sculptComponent = {
    id: 'baseSlabAssembly',
    name: 'Solid glass foot',
    level: 'meso',
    role: 'sub-assembly',
    importance: 0.6,
    confidence: 0.85,
    primitive: 'extrude',
    topologyClass: 'continuous-sculpt',
    topologyRationale:
      'The foot is the same continuous glass blank, distinguished only by carrying no liquid; it is modelled as part of the body profile with its own internal boundary.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'bottleBody',
    attachment: {
      parentSocket: 'bottleBody.interior',
      localStart: [0, 0.0, 0],
      localEnd: [0, 0.2, 0],
      contactType: 'embed',
      embedDepth: 0.2,
      gapTolerance: 0.0,
    },
    dimensions: { width: 1.0, height: 0.2, depth: 0.42 },
    transform: { position: [0, -0.49, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'glass',
    materialLayers: ['glass'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'slabBoundary',
        kind: 'contour',
        description: 'Horizontal internal boundary at the top of the solid foot.',
        evidenceRef: 'zones/zone-r2c1.png',
        confidence: 0.93,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'glass',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(113, 86, 46, 1.0)',
      secondaryAlbedo: 'rgba(207, 224, 224, 1.0)',
      materialClass: 'glass',
      materialClassConfidence: 0.85,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_baseSlabAssembly_7.add(mesh_baseSlabAssembly_7);
  meshes['baseSlabAssembly'] = mesh_baseSlabAssembly_7;
  colliders['baseSlabAssembly'] = { type: 'none', size: [0, 0, 0], isTrigger: false };

  const endpoint_grooveBand_8 = makeAttachmentEndpoint(null);
  const node_grooveBand_8 = new THREE.Group();
  node_grooveBand_8.name = 'Cap groove band__pivot';
  node_grooveBand_8.scale.set(1, 1, 1);
  if (endpoint_grooveBand_8) {
    node_grooveBand_8.position.copy(endpoint_grooveBand_8.start);
    node_grooveBand_8.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_grooveBand_8.position.set(0.0, -0.115, 0.0);
    node_grooveBand_8.rotation.set(0.0, 0.0, 0.0);
  }
  node_grooveBand_8.userData.sculptComponent = {
    id: 'grooveBand',
    name: 'Cap groove band',
    level: 'meso',
    role: 'sub-assembly',
    importance: 0.6,
    confidence: 0.85,
    primitive: 'lathe',
    topologyClass: 'surface-relief',
    topologyRationale:
      'Two turned recesses in the cap wall: relief on an existing surface, not a separate solid, but built as geometry because each groove edge catches its own highlight.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'cap',
    attachment: {
      parentSocket: 'cap.wall',
      localStart: [0, -0.13, 0],
      localEnd: [0, -0.1, 0],
      contactType: 'embed',
      embedDepth: 0.006,
      gapTolerance: 0.0,
    },
    dimensions: { radius: 0.21, height: 0.03 },
    transform: { position: [0, -0.115, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'satinCharcoal',
    materialLayers: ['satinCharcoal'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'grooveUpper',
        kind: 'groove',
        description: 'Upper of the two fine recessed circumferential grooves.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
      {
        id: 'grooveLower',
        kind: 'groove',
        description: 'Lower of the two fine recessed circumferential grooves.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'satinCharcoal',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(24, 28, 30, 1.0)',
      secondaryAlbedo: 'rgba(52, 56, 60, 1.0)',
      materialClass: 'plastic',
      materialClassConfidence: 0.88,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_grooveBand_8.userData.actionProfile = {
    animationRole: 'static',
    pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
    transformChannels: { translate: true, rotate: false, scale: false },
    collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
    constraints: [],
    destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
  };
  (nodes['cap'] ?? root).add(node_grooveBand_8);
  nodes['grooveBand'] = node_grooveBand_8;
  const mesh_grooveBand_8Geometry = endpoint_grooveBand_8
    ? new THREE.CylinderGeometry(
        endpoint_grooveBand_8.endRadius,
        endpoint_grooveBand_8.baseRadius,
        endpoint_grooveBand_8.length,
        16,
        6,
      )
    : buildLatheGeometry({
        points: [
          [0.3, -0.5],
          [0.15, 0.0],
          [0.3, 0.5],
        ],
        segments: 24,
      });
  if (!endpoint_grooveBand_8) {
    mesh_grooveBand_8Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_grooveBand_8 = new THREE.Mesh(
    mesh_grooveBand_8Geometry,
    materialMap['satinCharcoal'] ?? new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh_grooveBand_8.name = 'Cap groove band';
  if (endpoint_grooveBand_8) {
    mesh_grooveBand_8.position.copy(endpoint_grooveBand_8.midpoint);
    mesh_grooveBand_8.quaternion.copy(endpoint_grooveBand_8.quaternion);
  }
  mesh_grooveBand_8.castShadow = options.castShadow ?? true;
  mesh_grooveBand_8.receiveShadow = options.receiveShadow ?? true;
  mesh_grooveBand_8.userData.sculptComponent = {
    id: 'grooveBand',
    name: 'Cap groove band',
    level: 'meso',
    role: 'sub-assembly',
    importance: 0.6,
    confidence: 0.85,
    primitive: 'lathe',
    topologyClass: 'surface-relief',
    topologyRationale:
      'Two turned recesses in the cap wall: relief on an existing surface, not a separate solid, but built as geometry because each groove edge catches its own highlight.',
    geometryDescriptor: {
      topologyIntent:
        'filleted cuboid, bevel-ready edges, enough segments on the fillets to read round in silhouette at plate scale',
      edgeTreatment: { type: 'fillet', bevelRadius: 0.055, segments: 5 },
      deformationStack: [
        { op: 'shoulder-bevel', note: 'short flat inward step at the top, not a continuous curve' },
      ],
      uvStrategy: 'box projection per face',
      normalStrategy: 'smooth on fillets, flat on faces, split at the bevel',
    },
    parent: 'cap',
    attachment: {
      parentSocket: 'cap.wall',
      localStart: [0, -0.13, 0],
      localEnd: [0, -0.1, 0],
      contactType: 'embed',
      embedDepth: 0.006,
      gapTolerance: 0.0,
    },
    dimensions: { radius: 0.21, height: 0.03 },
    transform: { position: [0, -0.115, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    actionProfile: {
      animationRole: 'static',
      pivot: { mode: 'centre', position: [0, 0, 0], confidence: 0.85 },
      transformChannels: { translate: true, rotate: false, scale: false },
      collider: { type: 'none', size: [0, 0, 0], isTrigger: false },
      constraints: [],
      destruction: { breakable: false, breakImpulse: 0.0, mode: 'none' },
    },
    material: 'satinCharcoal',
    materialLayers: ['satinCharcoal'],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: [
      {
        id: 'grooveUpper',
        kind: 'groove',
        description: 'Upper of the two fine recessed circumferential grooves.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
      {
        id: 'grooveLower',
        kind: 'groove',
        description: 'Lower of the two fine recessed circumferential grooves.',
        evidenceRef: 'zones/zone-r0c1.png',
        confidence: 0.9,
      },
    ],
    surfaceDetail: {
      macroRoughness: 0.0,
      microRoughness: 0.0,
      bumpAmplitude: 0.0,
      normalPattern: '',
      displacementPattern: '',
      occlusionPattern: '',
      edgeWearPattern: '',
      notes: '',
    },
    evidenceRefs: ['full-object'],
    details: [],
    fidelityTier: 'blockout',
    materialRef: 'satinCharcoal',
    colorMaterialRecipe: {
      dominantAlbedo: 'rgba(24, 28, 30, 1.0)',
      secondaryAlbedo: 'rgba(52, 56, 60, 1.0)',
      materialClass: 'plastic',
      materialClassConfidence: 0.88,
      provenance:
        'inherited from the parent component recipe extracted by extract_part_color_recipe.py; this component shares its parent surface.',
    },
  };
  node_grooveBand_8.add(mesh_grooveBand_8);
  meshes['grooveBand'] = mesh_grooveBand_8;
  colliders['grooveBand'] = { type: 'none', size: [0, 0, 0], isTrigger: false };

  root.userData.sculptRuntime = {
    nodes,
    meshes,
    sockets,
    colliders,
    destructionGroups,
  } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {
    qualityPriority: 'reference-fidelity',
    materialPass: {
      albedoPaletteRequired: true,
      roughnessVariationRequired: true,
      normalOrBumpRequired: true,
      localOverridesRequired: true,
      minimumTextureResolution: 1024,
      preferredTextureResolution: 2048,
      independentMapChannels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
      requiredSurfaceFrequencyBands: ['macro', 'meso', 'micro'],
      geometryReliefRequiredWhenSilhouetteAffected: true,
      referencePbrExtraction: {
        requiredWhenSourceImagePresent: true,
        targetThreshold: 0.7,
        stopOnLowConfidence: true,
        script: 'forge/stage1_intake/extract_pbr_evidence.py',
        acceptedLimitation:
          'single-image extraction is reference-derived inference, not exact photogrammetry',
      },
      mustAvoid: [
        'single flat albedo per material',
        'uniform roughness',
        'albedo texture reused as roughness/height/normal/AO',
        'single-frequency random noise',
        'plastic-looking smooth bark, stone, cloth, foliage, or aged material',
        'local color/detail described only in prose without material masks',
        'claiming exact PBR recovery when confidence is below the target threshold',
      ],
    },
    lightingPass: {
      requiredTerms: [
        'key light',
        'fill light',
        'rim or environment light',
        'exposure',
        'tone mapping',
        'background',
        'contact shadow',
      ],
      mustAvoid: [
        'ambient-only lighting',
        'flat value range',
        'missing contact shadow',
        'reference lighting copied without separating material readability',
      ],
    },
    screenshotReview: [
      'Compare albedo palette and local color zones.',
      'Compare roughness/normal/bump response under light.',
      'Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.',
      'Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.',
      'Capture a neutral-light render to verify material readability without reference lighting.',
      'Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.',
      'Capture a reference-matched render from the same camera framing as the source.',
    ],
  };
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createPackagedUnit50MlFlaconLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = 'Packaged unit 50 ml flacon look-dev lights';
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [
    {
      id: 'key',
      type: 'area',
      azimuthDeg: -40,
      elevationDeg: 38,
      intensity: 2.6,
      size: 'large soft',
      note: 'Single large key from upper left, read off the highlight lobe. Exposure 1.0 with ACES filmic tone mapping, which is what keeps the amber out of clipping.',
    },
    {
      id: 'fill',
      type: 'ambient',
      azimuthDeg: 0,
      elevationDeg: 0,
      intensity: 0.35,
      note: 'Low ambient; the reference keeps deep shadow on the distal side.',
    },
    {
      id: 'rim',
      type: 'directional',
      azimuthDeg: 115,
      elevationDeg: 10,
      intensity: 0.9,
      note: 'Low rim separating the lateral-right edge from the ground.',
    },
    {
      id: 'environment',
      type: 'gradient',
      azimuthDeg: 0,
      elevationDeg: 90,
      intensity: 0.6,
      note: 'Transmissive materials need structure to refract; a vertical gradient environment supplies it without pretending to be a real room.',
    },
    {
      id: 'ground',
      type: 'shadow-catcher',
      azimuthDeg: 0,
      elevationDeg: -90,
      intensity: 0.55,
      note: 'Contact shadow under the base: soft and short, consistent with the large key. Ambient occlusion carries the remaining ground shadow. Background is flat dark desaturated teal-black matching the page ground.',
    },
  ];
  lights.userData.lookDevTargets = {
    qualityPriority: 'reference-fidelity',
    materialPass: {
      albedoPaletteRequired: true,
      roughnessVariationRequired: true,
      normalOrBumpRequired: true,
      localOverridesRequired: true,
      minimumTextureResolution: 1024,
      preferredTextureResolution: 2048,
      independentMapChannels: ['albedo', 'roughness', 'height', 'normal', 'ambient-occlusion'],
      requiredSurfaceFrequencyBands: ['macro', 'meso', 'micro'],
      geometryReliefRequiredWhenSilhouetteAffected: true,
      referencePbrExtraction: {
        requiredWhenSourceImagePresent: true,
        targetThreshold: 0.7,
        stopOnLowConfidence: true,
        script: 'forge/stage1_intake/extract_pbr_evidence.py',
        acceptedLimitation:
          'single-image extraction is reference-derived inference, not exact photogrammetry',
      },
      mustAvoid: [
        'single flat albedo per material',
        'uniform roughness',
        'albedo texture reused as roughness/height/normal/AO',
        'single-frequency random noise',
        'plastic-looking smooth bark, stone, cloth, foliage, or aged material',
        'local color/detail described only in prose without material masks',
        'claiming exact PBR recovery when confidence is below the target threshold',
      ],
    },
    lightingPass: {
      requiredTerms: [
        'key light',
        'fill light',
        'rim or environment light',
        'exposure',
        'tone mapping',
        'background',
        'contact shadow',
      ],
      mustAvoid: [
        'ambient-only lighting',
        'flat value range',
        'missing contact shadow',
        'reference lighting copied without separating material readability',
      ],
    },
    screenshotReview: [
      'Compare albedo palette and local color zones.',
      'Compare roughness/normal/bump response under light.',
      'Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.',
      'Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.',
      'Capture a neutral-light render to verify material readability without reference lighting.',
      'Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.',
      'Capture a reference-matched render from the same camera framing as the source.',
    ],
  };
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createPackagedUnit50MlFlaconEnvironment(
  renderer: THREE.WebGLRenderer,
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function framePackagedUnit50MlFlaconCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = maxDim / 2 / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createPackagedUnit50MlFlaconPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: {
    dof?: boolean;
    bloom?: boolean;
    bloomStrength?: number;
    dofFocus?: number;
    dofAperture?: number;
  } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(
      new BokehPass(scene, camera, {
        focus: options.dofFocus ?? 10.0,
        aperture: options.dofAperture ?? 0.0002,
        maxblur: 0.01,
      }),
    );
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configurePackagedUnit50MlFlaconRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createPackagedUnit50MlFlaconInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
