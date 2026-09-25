# Reference suitability verdict

Reference: `.img2threejs/reference.png` (1024x1024, technical probe `pass`).
Rubric: `grimoire/intake/validation_rubric.md`.

## Verdict: CONDITIONAL

### Why not `pass`

One view only, and the subject is a transparent vessel. The rubric's reject line for objects that
"rely primarily on smoke, liquid, glass caustics, or lace" is examined and does **not** apply here:
this object's identity lives in its **geometry** (cuboid body with vertical fillets, shoulder
bevel, thick unfilled base slab, stacked collar and cap), not in caustic light transport. The glass
and the amber juice are surface treatments over a form that reconstructs exactly from primitives.
No caustics are promised, and none are needed.

### Conditional clauses met

- One view only, but the body is bilaterally symmetric and the collar and cap are radially
  symmetric, so the hidden distal face is a defensible inference rather than an invention.
- Occlusion is limited to the collar's lower rim under the cap's shadow; the macro shape is clear.
- No brand text or logo fidelity is required: the label is deliberately blank.
- The target is hard-surface geometric and approximates exactly with procedural primitives.

### Declared stylization level

**Technical figure, not a photoreal render.** The model ships as the manual's illustrated plate for
the costing division, rendered in the committed brand palette with transmissive-but-stylized glass.
Refraction is approximated by `MeshPhysicalMaterial` transmission; there is no caustic projection,
no dispersion, and no environment reflection of a real room.

### Stated limits carried forward

- The distal face is symmetric by assumption.
- The neck interior, any spray pump, and the dip tube are **omitted**, not modelled, because the
  reference does not show them.
- Glass wall thickness is an estimate read off the visible inner-wall offset.
- The base underside is not visible and is built flat.

These become `unknownsToResolveBeforeImplementation`. None blocks the build.
