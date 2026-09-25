import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  SRGBColorSpace,
  Vector2,
  type Material,
} from 'three';

/**
 * Procedural model of the packaged unit, built in code from the measured sculpt
 * spec in `.img2threejs/object-sculpt-spec.json`. Every dimension below is the
 * body-width-relative figure recorded in that spec's `silhouette.aspectRatios`
 * and component dimensions; nothing here is eyeballed.
 *
 * It is a technical figure, not a photoreal render: transmission approximates
 * refraction, and there are no caustics, no dispersion and no environment
 * reflection. The distal face is symmetric by assumption, and the neck
 * internals are omitted rather than invented, because one view cannot show them.
 */

const BODY_WIDTH = 1.0;
const BODY_DEPTH = 0.42;
const BODY_HEIGHT = 1.18;
const CORNER_FILLET = 0.055;
const WALL = 0.05;

const BASE_SLAB_TOP = 0.2;
const MENISCUS = 0.944;

const SHOULDER_TOP = 1.27;
const COLLAR_BOTTOM = 1.24;
const COLLAR_TOP = 1.37;
const COLLAR_RADIUS = 0.22;
const CAP_HEIGHT = 0.315;
const CAP_RADIUS = 0.21;
const CAP_TOP_ROUND = 0.021;
const GROOVE_DEPTH = 0.006;

const RADIAL_SEGMENTS = 48;

/** Rounded rectangle in the XY plane, ready to extrude along Z. */
function roundedRect(width: number, depth: number, radius: number): Shape {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw, hd);
  const shape = new Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return shape;
}

/**
 * Extrudes a rounded rectangle upward along +Y, with its base at y = 0. The
 * curve segment count is what makes the four vertical corner fillets read as
 * round in silhouette rather than as chamfers.
 */
function extrudedProfile(
  width: number,
  depth: number,
  radius: number,
  height: number,
): BufferGeometry {
  const geometry = new ExtrudeGeometry(roundedRect(width, depth, radius), {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 8,
  });
  // Rotating -90° about X maps the extrusion axis (+Z) onto +Y and leaves the
  // swept range at y = 0..height, so the base already sits on the ground plane.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** Cap profile: straight wall, two turned grooves, a generous top round. */
function capProfile(): Vector2[] {
  const r = CAP_RADIUS;
  const inner = r - GROOVE_DEPTH;
  const points: Vector2[] = [
    new Vector2(0, 0),
    new Vector2(r, 0),
    new Vector2(r, 0.025),
    // Lower groove.
    new Vector2(inner, 0.032),
    new Vector2(inner, 0.04),
    new Vector2(r, 0.047),
    new Vector2(r, 0.056),
    // Upper groove.
    new Vector2(inner, 0.063),
    new Vector2(inner, 0.071),
    new Vector2(r, 0.078),
    // Wall up to the top round.
    new Vector2(r, CAP_HEIGHT - CAP_TOP_ROUND),
  ];

  // The top round, as real vertices: it is a tenth of the cap radius and shows
  // in silhouette, so it cannot be a normal map.
  const steps = 6;
  for (let i = 1; i <= steps; i += 1) {
    const a = (i / steps) * (Math.PI / 2);
    points.push(
      new Vector2(
        r - CAP_TOP_ROUND + CAP_TOP_ROUND * Math.cos(a),
        CAP_HEIGHT - CAP_TOP_ROUND + CAP_TOP_ROUND * Math.sin(a),
      ),
    );
  }
  points.push(new Vector2(0, CAP_HEIGHT));
  return points;
}

/** Collar profile: a turned sleeve with a small chamfer at each rim. */
function collarProfile(): Vector2[] {
  const r = COLLAR_RADIUS;
  const h = COLLAR_TOP - COLLAR_BOTTOM;
  const c = 0.008;
  return [
    new Vector2(0, 0),
    new Vector2(r - c, 0),
    new Vector2(r, c),
    new Vector2(r, h - c),
    new Vector2(r - c, h),
    new Vector2(0, h),
  ];
}

export type FlaconTier = 'concentrate' | 'juice' | 'packaged';

export type CostView = 'concentrate' | 'packaged';

export type FlaconModel = {
  root: Group;
  /** Bottle assembly that lifts off the bench in the concentrate view. */
  vessel: Group;
  /** Lab flask that seats when the bottle has left. */
  flask: Group;
  /** Pivot nodes the costing view drives, keyed by part. */
  tiers: Record<FlaconTier, Group>;
  materials: Material[];
  geometries: BufferGeometry[];
};

/** Neat-oil fill as a fraction of the bottled juice volume (EDP ~20%). */
export const CONCENTRATE_FILL = 0.2;
/** How far the bottle rises off the bench on the way to concentrate, in body widths. */
const BOTTLE_LIFT = 2.6;
/** How far the bottle shifts back while it clears the bench. */
const BOTTLE_BACK = 0.28;
/** How far the flask sits below the bench before it arrives. */
const FLASK_DROP = 1.2;

function smoothWindow(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  const t = Math.min(1, Math.max(0, (x - edge0) / span));
  return t * t * (3 - 2 * t);
}

/** Conical flask: flat foot, wide base, narrow neck, small lip. */
function erlenmeyerProfile(): Vector2[] {
  return [
    new Vector2(0, 0),
    new Vector2(0.4, 0),
    new Vector2(0.48, 0.05),
    new Vector2(0.54, 0.16),
    new Vector2(0.5, 0.4),
    new Vector2(0.26, 0.78),
    new Vector2(0.12, 0.94),
    new Vector2(0.12, 1.08),
    new Vector2(0.16, 1.12),
    new Vector2(0.16, 1.15),
    new Vector2(0, 1.15),
  ];
}

function erlenmeyerJuiceProfile(): Vector2[] {
  return [
    new Vector2(0, 0.02),
    new Vector2(0.42, 0.04),
    new Vector2(0.46, 0.28),
    new Vector2(0, 0.28),
  ];
}

const JUICE_CONCENTRATE = new Color(0x7a5424);
/** How far the closure lifts as the bottle leaves the bench, in body widths. */
export const CAP_LIFT = 0.32;

/** Dark plaque, two tracked lines — same wordmark as the dashboard vessel sticker. */
function brandLabelTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#1a1e22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f4f1ea';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 96px "Avenir Next", "Segoe UI", Helvetica, sans-serif';
  drawTracked(ctx, 'FRAGRANCE', canvas.width / 2, 190, 22);
  drawTracked(ctx, 'CHEMISTRY', canvas.width / 2, 330, 22);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, w) => sum + w, 0) + tracking * (text.length - 1);
  let x = centerX - total / 2;
  for (let i = 0; i < text.length; i += 1) {
    ctx.fillText(text[i], x + widths[i] / 2, y);
    x += widths[i] + tracking;
  }
}

/**
 * Builds the model. Colours come from the committed palette rather than from the
 * reference photograph: this is the manual's figure, so it has to sit in the
 * same world as the page around it.
 */
export function createFlaconModel(): FlaconModel {
  const glass = new MeshPhysicalMaterial({
    color: 0xeaf2f2,
    metalness: 0,
    roughness: 0.045,
    transmission: 0.94,
    ior: 1.5,
    thickness: 0.22,
    transparent: true,
    opacity: 1,
  });

  const juiceMaterial = new MeshPhysicalMaterial({
    color: 0xc9923e,
    metalness: 0,
    roughness: 0.02,
    transmission: 0.88,
    ior: 1.45,
    thickness: 0.3,
    attenuationColor: 0x8f6a32,
    attenuationDistance: 0.35,
    transparent: true,
  });

  const collarMaterial = new MeshStandardMaterial({
    color: 0xc9b487,
    metalness: 1,
    roughness: 0.31,
  });

  const capMaterial = new MeshStandardMaterial({
    color: 0x26292c,
    metalness: 0,
    roughness: 0.6,
  });

  const labelMap = brandLabelTexture();
  const labelMaterial = new MeshStandardMaterial({
    color: labelMap ? 0xffffff : 0x1a1e22,
    map: labelMap,
    metalness: 0,
    roughness: 0.82,
  });

  const bodyGeometry = extrudedProfile(BODY_WIDTH, BODY_DEPTH, CORNER_FILLET, BODY_HEIGHT);
  const juiceGeometry = extrudedProfile(
    BODY_WIDTH - WALL * 2,
    BODY_DEPTH - WALL * 2,
    CORNER_FILLET * 0.55,
    MENISCUS - BASE_SLAB_TOP,
  );
  const shoulderGeometry = extrudedProfile(
    BODY_WIDTH - 0.12,
    BODY_DEPTH - 0.12,
    CORNER_FILLET,
    SHOULDER_TOP - BODY_HEIGHT,
  );
  const collarGeometry = new LatheGeometry(collarProfile(), RADIAL_SEGMENTS);
  const capGeometry = new LatheGeometry(capProfile(), RADIAL_SEGMENTS);
  const labelGeometry = new PlaneGeometry(0.62, 0.32);

  const root = new Group();
  root.name = 'packaged-unit';

  // Tier 1: the concentrate, drawn as the juice volume inside the body.
  const concentrate = new Group();
  concentrate.name = 'tier-concentrate';
  const juiceMesh = new Mesh(juiceGeometry, juiceMaterial);
  juiceMesh.name = 'juice';
  juiceMesh.position.y = BASE_SLAB_TOP;
  concentrate.add(juiceMesh);

  // Tier 2: the diluted juice, which is the glass body it sits in.
  const juiceTier = new Group();
  juiceTier.name = 'tier-juice';
  const bodyMesh = new Mesh(bodyGeometry, glass);
  bodyMesh.name = 'bottleBody';
  const shoulderMesh = new Mesh(shoulderGeometry, glass);
  shoulderMesh.name = 'shoulderAssembly';
  shoulderMesh.position.y = BODY_HEIGHT;
  const labelMesh = new Mesh(labelGeometry, labelMaterial);
  labelMesh.name = 'label';
  // Plane faces +Z, flush on the front face so it does not poke past the silhouette.
  labelMesh.position.set(0, 0.62, BODY_DEPTH / 2 + 0.002);
  labelMesh.renderOrder = 2;
  // The glass transmission pass rebakes opaque meshes and refracts them. That
  // second copy reads as a faded label sticking out of the bottle. Skip writing
  // the sticker into any offscreen target; the main pass (target === null) keeps it.
  labelMesh.onBeforeRender = (renderer) => {
    const onCanvas = renderer.getRenderTarget() === null;
    labelMaterial.colorWrite = onCanvas;
    labelMaterial.depthWrite = onCanvas;
  };
  juiceTier.add(bodyMesh, shoulderMesh, labelMesh);

  // Tier 3: the packaged unit, the closure hardware.
  const packaged = new Group();
  packaged.name = 'tier-packaged';
  const collarMesh = new Mesh(collarGeometry, collarMaterial);
  collarMesh.name = 'collar';
  collarMesh.position.y = COLLAR_BOTTOM;
  const capMesh = new Mesh(capGeometry, capMaterial);
  capMesh.name = 'cap';
  capMesh.position.y = COLLAR_TOP;
  packaged.add(collarMesh, capMesh);

  const vessel = new Group();
  vessel.name = 'vessel';
  vessel.add(concentrate, juiceTier, packaged);

  const flaskGlass = glass.clone();
  const flaskJuiceMat = new MeshPhysicalMaterial({
    color: JUICE_CONCENTRATE,
    metalness: 0,
    roughness: 0.04,
    transmission: 0.55,
    ior: 1.45,
    thickness: 0.2,
    transparent: true,
  });
  const flaskGeo = new LatheGeometry(erlenmeyerProfile(), RADIAL_SEGMENTS);
  const flaskJuiceGeo = new LatheGeometry(erlenmeyerJuiceProfile(), RADIAL_SEGMENTS);
  const flask = new Group();
  flask.name = 'erlenmeyer';
  const flaskBody = new Mesh(flaskGeo, flaskGlass);
  flaskBody.name = 'flask-body';
  const flaskJuice = new Mesh(flaskJuiceGeo, flaskJuiceMat);
  flaskJuice.name = 'flask-juice';
  flask.add(flaskBody, flaskJuice);
  flask.position.y = -FLASK_DROP;
  flask.visible = false;

  root.add(vessel, flask);

  // Centre the assembly on its own bounding height so the figure sits in frame.
  root.position.y = -(COLLAR_TOP + CAP_HEIGHT) / 2;

  return {
    root,
    vessel,
    flask,
    tiers: { concentrate, juice: juiceTier, packaged },
    materials: [
      glass,
      juiceMaterial,
      collarMaterial,
      capMaterial,
      labelMaterial,
      flaskGlass,
      flaskJuiceMat,
    ],
    geometries: [
      bodyGeometry,
      juiceGeometry,
      shoulderGeometry,
      collarGeometry,
      capGeometry,
      labelGeometry,
      flaskGeo,
      flaskJuiceGeo,
    ],
  };
}

/**
 * Pose the costing plate. `packaged` is 1 for the seated SKU and 0 for the
 * concentrate flask. The bottle clears the bench first; the Erlenmeyer seats
 * in the second half of the same curve, and the reverse plays it backwards.
 */
export function applyCostView(model: FlaconModel, packaged: number): void {
  const t = Math.min(1, Math.max(0, packaged));
  const towardConcentrate = 1 - t;
  const bottleLift = smoothWindow(0, 0.62, towardConcentrate);
  const flaskRise = smoothWindow(0.38, 1, towardConcentrate);

  model.vessel.position.y = BOTTLE_LIFT * bottleLift;
  model.vessel.position.z = -BOTTLE_BACK * bottleLift;
  model.tiers.juice.position.y = 0;
  model.tiers.packaged.position.y = CAP_LIFT * bottleLift;

  const juice = model.tiers.concentrate.getObjectByName('juice');
  if (juice) juice.scale.y = 1;

  model.flask.position.y = -FLASK_DROP * (1 - flaskRise);
  model.flask.visible = flaskRise > 0.02;
}

/**
 * Weigh-leaf pour: open bottle, juice height tracks pan mass.
 * `fill01` is panGrams / targetGrams (1 = on target; >1 shows overshoot).
 *
 * Critical: do NOT use MeshPhysical transmission here. On the dark leaf the
 * transmission pass loses depth fights with the opaque pan disc, so the pan
 * reads as slicing through the bottle even when the AABB clears. Opacity-only
 * glass + opaque-ish amber juice keeps layering correct.
 *
 * Collar (neck ring) stays on the bottle. Cap is reparented onto the bench by
 * WeighScaleFigure — leave it alone if already moved.
 */
export function applyWeighFill(model: FlaconModel, fill01: number): void {
  const fill = Math.max(0, fill01);
  const juice = model.tiers.concentrate.getObjectByName('juice');
  if (juice) {
    juice.scale.y = Math.min(0.65, Math.max(0.05, fill * 0.45));
    juice.scale.x = 1.04;
    juice.scale.z = 1.04;
    juice.position.y = 0.12;
    juice.visible = fill > 0.001;
    juice.renderOrder = 1;
    const material = (juice as Mesh).material;
    if (material instanceof MeshPhysicalMaterial) {
      material.color.set(0xe8b45a);
      material.transmission = 0;
      material.opacity = 0.92;
      material.transparent = true;
      material.roughness = 0.22;
      material.metalness = 0;
      material.thickness = 0;
      material.depthWrite = true;
      material.depthTest = true;
    }
  }
  model.tiers.juice.position.y = 0;
  model.tiers.juice.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    mesh.renderOrder = 2;
    const material = mesh.material;
    if (material instanceof MeshPhysicalMaterial) {
      material.color.set(0xd5e6e6);
      material.transmission = 0;
      material.opacity = 0.38;
      material.transparent = true;
      material.roughness = 0.12;
      material.metalness = 0;
      material.thickness = 0;
      material.ior = 1.5;
      material.depthWrite = true;
      material.depthTest = true;
    }
  });
  // Open bottle: gold collar stays on the original shoulder; cap lives on the bench.
  model.tiers.packaged.visible = true;
  model.tiers.packaged.position.y = 0;
  const collar = model.tiers.packaged.getObjectByName('collar');
  if (collar) {
    collar.visible = true;
    collar.position.y = COLLAR_BOTTOM;
  }
  const shoulder = model.tiers.juice.getObjectByName('shoulderAssembly');
  if (shoulder) shoulder.visible = true;
  const cap = model.tiers.packaged.getObjectByName('cap');
  if (cap) cap.visible = false;
}
