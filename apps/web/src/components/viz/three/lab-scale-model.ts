import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Material,
} from 'three';

/**
 * Procedural top-pan analytical balance for the landing Weigh leaf.
 * Dark housing + stainless pan from DESIGN.md tokens (ink / paper / teal accent).
 * Code-only — no downloaded meshes.
 *
 * Layout rule: the housing is a visible plinth under the pan. Nothing opaque
 * rises through the flacon volume — the pan disc is the contact plane.
 */

export type LabScaleModel = {
  root: Group;
  /** Pan that receives the flacon; Y settles slightly with mass. */
  pan: Group;
  /** Socket on the pan where the flacon root should be parented. */
  deck: Group;
  materials: Material[];
  geometries: BufferGeometry[];
  /** Resting pan Y; applyWeighMass offsets from this. */
  panRestY: number;
};

/**
 * Bench-scale body — wide enough to read under the disc, tall enough that the
 * front face shows below the pan rim from the Weigh camera.
 */
const HOUSING_W = 1.35;
const HOUSING_D = 0.92;
const HOUSING_H = 0.32;
const PAN_R = 0.58;
const PAN_H = 0.038;
/** Air under the disc so the plinth reads as a separate body. */
const PAN_CLEARANCE = 0.055;
/** Short post under the disc — stays entirely below the pan plane. */
const COLUMN_R = 0.11;
const COLUMN_H = PAN_CLEARANCE;

export function createLabScaleModel(): LabScaleModel {
  // Mid charcoal — must lift off the dark leaf canvas (pure ink vanishes).
  const housingMat = new MeshStandardMaterial({
    color: 0x2a3a44,
    metalness: 0.28,
    roughness: 0.58,
  });
  const accentMat = new MeshStandardMaterial({
    color: 0x3dafa3,
    metalness: 0.4,
    roughness: 0.35,
    emissive: 0x2a9d8f,
    emissiveIntensity: 0.35,
  });
  const steelMat = new MeshStandardMaterial({
    color: 0x9aa3a9,
    metalness: 0.8,
    roughness: 0.34,
  });
  const columnMat = new MeshStandardMaterial({
    color: 0x6e787e,
    metalness: 0.65,
    roughness: 0.4,
  });

  const baseGeo = new BoxGeometry(HOUSING_W, HOUSING_H, HOUSING_D);
  const accentGeo = new BoxGeometry(0.72, 0.028, 0.032);
  const panGeo = new CylinderGeometry(PAN_R, PAN_R * 0.985, PAN_H, 48);
  const columnGeo = new CylinderGeometry(COLUMN_R, COLUMN_R * 1.15, COLUMN_H, 24);
  const footGeo = new CylinderGeometry(0.06, 0.075, 0.045, 16);

  const root = new Group();
  root.name = 'lab-scale';

  const base = new Mesh(baseGeo, housingMat);
  base.name = 'scale-housing';
  base.position.y = HOUSING_H / 2;
  base.renderOrder = 0;

  // Teal status bar on the front face — the cue that this is the instrument.
  const accent = new Mesh(accentGeo, accentMat);
  accent.name = 'scale-accent';
  accent.position.set(0, HOUSING_H * 0.38, HOUSING_D / 2 + 0.014);
  accent.renderOrder = 0;

  // Column under the pan only — never into the flacon.
  const column = new Mesh(columnGeo, columnMat);
  column.name = 'pan-column';
  column.position.y = HOUSING_H + COLUMN_H / 2;
  column.renderOrder = 0;

  const panRestY = HOUSING_H + PAN_CLEARANCE + PAN_H / 2;
  const pan = new Group();
  pan.name = 'scale-pan';
  pan.position.set(0, panRestY, 0);

  const panMesh = new Mesh(panGeo, steelMat);
  panMesh.name = 'pan-disc';
  panMesh.renderOrder = 0;
  pan.add(panMesh);

  const deck = new Group();
  deck.name = 'flacon-deck';
  deck.position.y = PAN_H / 2 + 0.004;
  pan.add(deck);

  for (const [x, z] of [
    [-0.52, -0.32],
    [0.52, -0.32],
    [-0.52, 0.32],
    [0.52, 0.32],
  ] as const) {
    const foot = new Mesh(footGeo, steelMat);
    foot.position.set(x, 0.022, z);
    foot.renderOrder = 0;
    root.add(foot);
  }

  root.add(base, accent, column, pan);

  return {
    root,
    pan,
    deck,
    materials: [housingMat, accentMat, steelMat, columnMat],
    geometries: [baseGeo, accentGeo, panGeo, columnGeo, footGeo],
    panRestY,
  };
}

/** Settle the pan a few millimetres under load (fill01 ≈ panGrams / target). */
export function applyWeighMass(scale: LabScaleModel, fill01: number): void {
  const load = Math.min(1.4, Math.max(0, fill01));
  scale.pan.position.y = scale.panRestY - 0.014 * load;
}
