# Image Analysis Protocol

Use this reference **first**, before `probe_image.py` and before the pre-spec assessment. It
exists because the agent tends to glance at the whole image once and jump straight to code,
skipping the disciplined observation that every later gate depends on. This is a **generic,
object-agnostic** protocol — it applies to any subject (prop, tool, weapon, vehicle part,
botanical, mechanical, character). Domain tracks (catalogued skins, characters) are specializations
layered _after_ this pass, not replacements for it.

## The Rule

Describe what is **there**, in a fixed bottom-up order, using controlled 3D vocabulary — not
what it _means_ or how it _feels_. Three disciplines carry the whole protocol:

1. **Observation before inference.** State the observable fact ("a low-roughness band along the
   spine") separately from what you infer from it ("probably a polished bevel"). Mark every
   inference as inference.
2. **Controlled vocabulary over adjectives.** Use the terms below and in
   `grimoire/glossary/3d_vocabulary.md`. Never "nice / sleek / aggressive / high-quality".
3. **3D object-space, not 2D image-space.** Describe parts by front/back/lateral/proximal, not
   left/right-of-the-photo. A single photo is a projection — say what perspective hides.

Run the layers in order; each feeds a real assessment field (mapping at the end). The output of
this protocol IS the raw material for `new_pre_spec_assessment.py` and `build_detail_inventory.py`.

## Layer 1 — Identification & classification

- **Observe:** what the object _is_, its category, and your confidence. Complete a physical
  inventory before any claim about value/purpose.
- **Vocabulary:** work type (a specific noun — _statuette, karambit, socket wrench, rhyton_),
  broad classification (_bladed tool, furnishing, mechanical part_), `primaryDomain`
  (`object` | `character` | `hybrid`), confidence 0–1.
- **Avoid:** using the object's _title/name_ as the description; asserting meaning before the
  inventory; indexing beyond the visible evidence.

## Layer 2 — Overall form & silhouette

- **Observe:** the bounding volume and footprint as a small set of primitives; symmetry.
- **Vocabulary:** primitives (_cuboid, cylinder, sphere, cone, extruded profile, lofted curve_);
  symmetry (_bilateral, radial, asymmetric_); shape language (_geometric_ vs _organic_);
  aspect/proportion relative to a named reference dimension.
- **Avoid:** emotive shape words; "large/small" with no reference; forcing an organic form into
  one primitive when it is a blend.

## Layer 3 — Macro → meso → micro decomposition

- **Observe:** the whole broken into major assemblies, then sub-parts, then surface-level
  feature groups — a `parent-child` hierarchy for component-based modelling.
- **Vocabulary:** macro (independent major parts — _blade, grip, guard_), meso (sub-assemblies —
  _rivet row, finger choil, pommel_), micro (feature groups — _fastener cluster, engraving band_).
- **Avoid:** treating the object as one monolithic mesh; over-nesting a simple structure; skipping
  a level (jumping macro → micro with no meso).

## Layer 4 — Spatial relationships (scene-graph)

- **Observe:** how parts connect and sit relative to each other, in 3D.
- **Vocabulary:** visual triplets `<subject, predicate, object>` (`<guard, separates, blade+grip>`);
  spatial predicates _attached-to, above, below, inside, behind, flush-with, embedded-in_; each
  connection notes a contact type (_butt, overlap, socket, embed_).
- **Avoid:** 2D image-space placement (left/right of frame); describing adjacency without stating
  how the parts actually join (mid-air parts break the attachment gate later).

## Layer 5 — Materials & surface (PBR)

- **Observe:** the substance of each part and how it responds to light. One material claim per
  distinct surface, tied to a component.
- **Vocabulary:** _albedo/base color_ (surface color with lighting removed), _metalness_
  (0 dielectric / 1 raw metal), _roughness_ (0 polished → 1 matte), _specular F0_ (~4% for
  dielectrics), _normal/relief_ (_pitting, grain, pores, brushing_), _translucency_
  (_opaque / semi-translucent / transparent_).
- **Avoid:** reading baked-in highlights/shadows as albedo; calling shiny plastic "metal";
  aliasing one channel into another (see `grimoire/feedback/shading_realism.md`).

## Layer 6 — Color & finish

- **Observe:** hue, value, saturation per region; the surface finish.
- **Vocabulary:** _hue / value / saturation_; finish _matte, satin, gloss, metallic, anodized_;
  gradients as ordered stops with positions, not "fades to".
- **Avoid:** subjective/brand color names ("royal blue") instead of standard descriptors
  ("vivid blue, mid value"); one flat color where a gradient or multi-tone finish exists.

## Layer 7 — Identity-defining features

- **Observe:** the marks that make _this_ item recognizable, not a generic member of its class.
- **Vocabulary:** inscriptions/marks (signatures, dates, logos, serials), wear patterns
  (_scratch, dent, oxidation/patina, stain, edge-wear_), recurring motifs.
- **Avoid:** overlooking small but critical identifiers (a maker's mark, a unique gouge that
  changes topology). Each identity feature should become a `detailInventory` entry and, if it
  can be wrong, a `featureReviewTarget`.

## Layer 8 — Uncertainty & single-image limits

- **Observe:** what the one view does not show; what is blurry or ambiguous.
- **Vocabulary:** _occluded_ (blocked by another part), _hidden_ (back-face / interior, not in
  this view), _uncertain_ (blurry/ambiguous), _needs another view_, _undetermined_.
- **Avoid:** hallucinating occluded/hidden detail without flagging it speculative; ignoring
  perspective distortion. Every unknown here becomes a
  `preSpecAssessment.unknownsToResolveBeforeImplementation` entry and may justify `request-input`.

## Output → where each layer lands

| Layer                   | Feeds                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| 1 identification        | `objectClass.primaryType` / `primaryDomain`, complexity classification |
| 2 form & silhouette     | complexity tier, geometry strategy, `referenceCamera` framing          |
| 3 macro/meso/micro      | `componentTree` levels + `minimumSpecDepth`                            |
| 4 spatial relationships | `attachment` (parentSocket, contactType, embed/overlap)                |
| 5 materials & surface   | `materials` PBR channels + `material.localOverrides`                   |
| 6 color & finish        | `colorMaterialRecipe`, gradient stops, `finishStyle`                   |
| 7 identity features     | `detailInventory` details + `featureReviewTargets`                     |
| 8 uncertainty           | `unknownsToResolveBeforeImplementation`, `request-input` decision      |

## Domain specializations (apply after this pass)

This generic pass runs for every subject. When Layer 1 identifies a specialized domain, layer its
extra rules on top **without** skipping any generic layer:

- **A catalogued skin or finish** → the serving plugin's own finish rulebook (finish style, wear, seed, paint
  view-dependent environment) and its texture-acquisition guide. Both ship with that plugin; with
  none installed, infer the finish from the reference.
- **Characters / hybrids** → `grimoire/character/reconstruction.md` (head-units, landmarks,
  proportion lock).

The generic protocol decides _what is there_; the domain doc decides _how that class is
conventionally parameterized_.
