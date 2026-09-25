# Image analysis — packaged unit (50 ml perfume flacon)

Reference: `.img2threejs/reference.png`. Layered observation protocol per
`grimoire/intake/image_analysis.md`. Observations are stated separately from inferences; every
inference is marked INFER.

## Layer 1 — Identification & classification

- Work type: **rectangular glass perfume flacon with metal collar and cylindrical overcap**.
- Broad classification: furnishing / consumer packaging vessel, hard-surface man-made.
- `primaryDomain`: `object`. Confidence 0.95.
- Physical inventory: one transparent vessel body; one filled liquid volume inside it; one opaque
  annular collar at the neck; one opaque cylindrical cap above the collar; one small planar label
  applied to the front face. Five discrete parts, no fasteners, no articulation.

## Layer 2 — Overall form & silhouette

- Bounding volume: a single **cuboid** with vertical edge fillets, surmounted by two stacked
  **cylinders** (collar, then cap) on the proximal-superior axis.
- Symmetry: **bilateral** about the front-facing sagittal plane; near-bilateral about the lateral
  plane. The cap and collar are **radial**.
- Shape language: geometric throughout, no organic curvature.
- Proportion against the body width taken as 1.0: body height ≈ 1.18, body depth ≈ 0.42,
  collar diameter ≈ 0.44, collar height ≈ 0.13, cap diameter ≈ 0.42, cap height ≈ 0.33.
- INFER: the body is a solid-walled press-moulded blank, given the thick base and the visible
  internal wall boundary.

## Layer 3 — Macro → meso → micro decomposition

- Macro: `bottleBody`, `juice`, `collar`, `cap`, `label`.
- Meso: on `bottleBody` — `shoulderBevel` (the short flat step inward at the top), `neck`
  (short cylinder rising from the shoulder), `baseSlab` (the thick unfilled glass at the bottom),
  `cornerFillets` (four vertical rounds). On `cap` — `machinedGroove` (a single fine recessed
  band near the lower edge), `capChamfer` (a slight round at the top edge).
- Micro: `liquidMeniscus` (the crisp horizontal liquid boundary on the inner wall),
  `collarBrushing` (fine circumferential brushing on the metal), `labelEdge`.

## Layer 4 — Spatial relationships (scene graph)

- `<juice, inside, bottleBody>` — contact type: embed. The juice volume is inset from the inner
  wall by the glass thickness.
- `<collar, attached-to, neck>` — contact type: socket. The collar sleeves down over the neck and
  its lower rim sits flush with the shoulder.
- `<cap, attached-to, collar>` — contact type: butt. The cap's lower face rests on the collar's
  upper rim, coaxial.
- `<label, flush-with, bottleBody front face>` — contact type: overlap, centred laterally and set
  low on the face.
- No part floats: every child has a named parent socket.

## Layer 5 — Materials & surface (PBR)

- `bottleBody`: transparent dielectric. albedo near-neutral with a faint cool tint, metalness 0,
  roughness 0.03–0.06, specular F0 ≈ 4%, transmission high, IOR ≈ 1.5, translucency
  **transparent**. Observation: the rear inner wall is visible through the front wall, and the
  base slab shows internal refraction of the body edges.
- `juice`: transparent dielectric, albedo warm amber, mid value, mid-high saturation; metalness 0,
  roughness 0.02, transmission high, with visible absorption increasing through thickness
  (the centre reads darker than the edges). Translucency **transparent**.
- `collar`: raw metal. metalness 1.0, roughness 0.28–0.35, albedo pale warm gold. Normal/relief:
  fine circumferential **brushing**.
- `cap`: opaque dielectric. metalness 0, roughness 0.55–0.65, albedo very dark neutral charcoal.
  Finish reads satin, not gloss: the key light returns a broad low-intensity lobe, not a point.
- `label`: opaque dielectric, metalness 0, roughness 0.85, albedo muted off-white, paper grain.
- Noted and excluded from albedo: the bright vertical highlight down the proximal-left body edge
  and the rim light on the lateral-right edge are lighting, not surface colour.

## Layer 6 — Colour & finish

- `bottleBody`: hue neutral, high value, near-zero saturation; finish **gloss**.
- `juice`: hue amber/orange-yellow, mid value, mid-high saturation; a vertical absorption
  gradient with stops at roughly 0% (lighter, at the meniscus) and 100% (deeper, at the base).
- `collar`: hue pale yellow, high value, low saturation; finish **metallic**, brushed.
- `cap`: hue neutral, low value, near-zero saturation; finish **satin**.
- `label`: hue warm neutral, high value, very low saturation; finish **matte**.

## Layer 7 — Identity-defining features

1. The **thick unfilled glass base slab** — roughly the lower fifth of the body carries no liquid
   and refracts the body's own edges. Without it the flacon reads as a thin-walled bottle.
2. The **crisp liquid meniscus** at about four fifths fill height, drawn as a hard line on the
   inner wall.
3. The **shoulder bevel**: the face steps inward on a short flat before the neck, rather than
   curving continuously.
4. The single **machined groove** near the cap's lower edge.
5. The **vertical corner fillets** — small radius, constant along the full body height.
6. The **blank label**: a plain rectangle with no lettering, set low and centred.

Each becomes a `detailInventory` entry; 1, 2 and 3 are `featureReviewTargets` because each can be
built wrong while the global silhouette still scores well.

## Layer 8 — Uncertainty & single-image limits

- **hidden**: the entire distal (back) face, the bottom of the base, and the interior of the neck.
  Bilateral symmetry is assumed for the back face — INFER, flagged speculative.
- **hidden**: whether a spray pump and dip tube sit inside the neck. None is visible; the model
  will omit the internals and say so.
- **occluded**: the collar's lower rim where the cap's shadow falls on it.
- **uncertain**: exact glass wall thickness. Estimated from the visible inner-wall offset at the
  proximal-left edge; recorded as an estimate.
- **uncertain**: whether the cap's top face is flat or very slightly domed. Reads flat with a
  chamfer; built flat.
- **undetermined**: the label's material weight (paper vs coated stock).

None of these unknowns blocks the build; all are recorded in
`preSpecAssessment.unknownsToResolveBeforeImplementation`. The delivered model is therefore an
**approximate reconstruction from a single view**, exact on the visible front and lateral faces
and symmetric-by-assumption behind.
