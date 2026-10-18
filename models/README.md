CO₂ PCB interactive model
========================

`co2-sensor.glb` is generated from the user-provided `pcb_co2.step` (EasyEDA /
Open CASCADE STEP, 2026-10-18). It retains all 518 components and their STEP
geometry, merged into ten material meshes for efficient rendering. Missing PCB
finishes are restored from the supplied reference: blue solder mask, gold
exposed pads and antenna, white silkscreen, and a silver RF shield. Rear copper
uses an embedded surface texture registered to the rear PCB layout, with blue
solder mask and gold pads. This avoids painting entire CAD triangles gold.
Header spacer faces at z=-2.5..0 mm are black plastic; exposed contact faces
keep their metallic finish. No source
file was uploaded to a conversion service. Coordinates are converted from
millimeters / Z-up to meters / Y-up.

Conversion: occt-import-js 0.0.23, ReadStepFile with linearUnit millimeter,
linearDeflectionType absolute_value, linearDeflection 0.035,
angularDeflection 0.3. Save the result as mesh JSON, then run:

    python scripts/co2-materials.py mesh.json images/making/co2-sensor-board.webp data/co2-materials.json
    node scripts/step-mesh-to-glb.cjs mesh.json models/co2-sensor.glb data/co2-materials.json

The self-hosted viewer is the classic UMD build of @google/model-viewer 4.4.0 (Apache-2.0), with its
license in `js/model-viewer.LICENSE`, runtime `js/model-viewer.umd.js`.
It is loaded by the background preload queue after critical images; the
front board photograph is the loading poster and error fallback.
The interactive model, paired board photographs, and paired PCB layouts share the same
Embla slider as the mobile manipulator, including its three-second cadence.
Dragging the model is excluded from carousel gestures; interaction and open
image dialogs pause automatic advance.
`scripts/build-co2-layout-panel.py` aligns both original layout PNGs by their
board outlines and renders a single high-quality WebP, with equal padding.
`scripts/build-co2-board-panel.py` pairs the two board photographs, adjusting
their framing to give the boards a similar size and alignment. HEIC sources
are converted to high-quality WebP with their orientation preserved.

The GLB is fetched directly over HTTPS or localhost, with all geometry and
textures embedded. There is no base64 payload, decompression step, runtime CDN,
or conversion service. Loading times out after 45 seconds with a static preview
and retry control rather than an indefinite spinner. Direct `file://` model
viewing is intentionally unsupported; use the preview server in the root README.

Sources: https://github.com/kovacsv/occt-import-js and https://modelviewer.dev/
