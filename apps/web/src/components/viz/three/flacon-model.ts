import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
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
  /** Pivot nodes the costing view drives, keyed by part. */
  tiers: Record<FlaconTier, Group>;
  materials: Material[];
  geometries: BufferGeometry[];
};

/** Neat-oil fill as a fraction of the bottled juice volume (EDP ~20%). */
export const CONCENTRATE_FILL = 0.2;
/** How far the closure lifts when the bottle is still concentrate, in body widths. */
export const CAP_LIFT = 0.32;

const JUICE_CONCENTRATE = new Color(0x7a5424);
const JUICE_PACKAGED = new Color(0xc9923e);

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

  const labelMaterial = new MeshStandardMaterial({
    color: 0xd8d3c8,
    metalness: 0,
    roughness: 0.88,
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
  const labelGeometry = new BoxGeometry(0.4, 0.17, 0.004);

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
  labelMesh.position.set(0, 0.35, BODY_DEPTH / 2 + 0.002);
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

  root.add(concentrate, juiceTier, packaged);

  // Centre the assembly on its own bounding height so the figure sits in frame.
  root.position.y = -(COLLAR_TOP + CAP_HEIGHT) / 2;

  return {
    root,
    tiers: { concentrate, juice: juiceTier, packaged },
    materials: [glass, juiceMaterial, collarMaterial, capMaterial, labelMaterial],
    geometries: [
      bodyGeometry,
      juiceGeometry,
      shoulderGeometry,
      collarGeometry,
      capGeometry,
      labelGeometry,
    ],
  };
}

/**
 * Pose the flacon for a costing view. `packaged` is 0 for concentrate (open
 * bottle, a slug of neat oil) and 1 for the assembled SKU (cap seated, full fill).
 * The glass body never leaves its socket; this is filling and capping, not an explode.
 */
export function applyCostView(model: FlaconModel, packaged: number): void {
  const t = Math.min(1, Math.max(0, packaged));
  const juice = model.tiers.concentrate.getObjectByName('juice');
  if (juice) {
    juice.scale.y = CONCENTRATE_FILL + (1 - CONCENTRATE_FILL) * t;
    const material = (juice as Mesh).material;
    if (material instanceof MeshPhysicalMaterial) {
      material.color.lerpColors(JUICE_CONCENTRATE, JUICE_PACKAGED, t);
    }
  }
  model.tiers.juice.position.y = 0;
  model.tiers.packaged.position.y = CAP_LIFT * (1 - t);
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
