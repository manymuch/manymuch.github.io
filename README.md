# Jiaxin (Jimmy) Zhang — portfolio

A static GitHub Pages site. Publish the repository root; no framework, build
step, server-side code, external font service, or runtime CDN is required.

## Preview and edit

Run from the repository root:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/`. Interactive 3D requires HTTP or HTTPS; opening
`index.html` directly is not a supported preview method.

- `index.html`: content, accessible media links, and baked-in chart snapshots.
- `css/site.css`: native layout, typography, NVIDIA colors, and light/dark themes.
- `js/navigation.js`, `contacts.js`, `media-viewer.js`, `galleries.js`: separate
  enhancements; content and gallery image links work without JavaScript.
- `js/loading.js`: shared two-slot priority queue. Profile assets load first;
  visible images and first gallery previews precede the model, then remaining
  previews load in the background. Scrolling or selecting slides promotes work.
- `js/co2-model.js`: direct hosted GLB loading, progress, timeout, and retry.
- `js/smart-home.js`: optional live statistics refresh near that section;
  checked-in charts remain visible when APIs are blocked or unavailable.

Phones intentionally use a 1280-pixel desktop viewport with pinch zoom enabled.
There is no mobile drawer or separate portrait reading layout. Animations use
WebP, with still posters for reduced motion. Galleries advance every three
seconds and pause for interaction, hidden pages, and open media dialogs.

## Assets

Small static previews and animated WebP previews are separate from full-size
popup assets. Keep `width`, `height`, `alt`, and `decoding` on images. Use
`data-original` for a static preview's full-size source; a media link's `href`
or `data-full-src` supplies the popup asset. Animated `<picture>` sources use
`data-srcset` until the loading queue activates them; the `<img>` is a still
poster that also works without JavaScript.

Optional generation commands (publishing does not run them):

```sh
python scripts/build-previews.py
python scripts/build-co2-board-panel.py
python scripts/build-co2-layout-panel.py
python scripts/build-smart-home.py
python scripts/optimize-animations.py /path/to/original/animations
node scripts/build-media.cjs
```

Image scripts require Pillow; PCB material/layout tooling also requires NumPy.
`build-media.cjs` requires the optional `sharp` package (`npm install --no-save
--package-lock=false sharp`). Original animation inputs belong outside the
published repository; never repeatedly recompress the generated WebP files.
The DOC composition keeps editable SVG geometry and image sources under
`scripts/media-sources/`. See [model tooling](models/README.md) and
[chart data provenance](data/README.md).

When changing asset contents, update the corresponding stylesheet/script URL
version in HTML. The model viewer has a distinct `.umd.js` filename so older
cached module builds cannot be mistaken for a classic script.

## Checks

```sh
python scripts/check-site.py
python scripts/check-site.py --images
node scripts/check-runtime.cjs
```

These check case-sensitive local references and anchors, required image
metadata, embedded GLB resources, image/animation integrity, preload order,
queue concurrency, task failures, and preview fallback. JavaScript can also be
checked with `node --check js/<filename>.js`.

The refactor reduced the working tree from 92.4 MiB to approximately 35 MiB.
Six parser-blocking head scripts (141.9 KiB) were removed. Three composite
image previews now total 0.20 MiB instead of 5.85 MiB. The PCB GLB is
byte-identical to the original; its geometry and finishes were not simplified.
These are asset/request measurements, not an Internet-speed benchmark.

Browser QA covered desktop layouts, media dialogs, gallery arrows and pause,
clipboard feedback, successful model loading, missing-model retry, missing
image fallback, no-script galleries, and a throttled model response retaining
its poster/progress until ready. Model rotation leaves its carousel stationary.
Dark styles were checked using a local CSS fixture, and phone viewport checks
preserved desktop columns. Actual Safari/Firefox, phone hardware, browser zoom
behavior, and real mobile-network timings still need device testing. Current Chromium,
Firefox, and Safari are the intended targets; Internet Explorer is not supported.

## Attribution

- Original visual layout: [Read Only by HTML5 UP](https://html5up.net/read-only),
  adapted under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- [Embla Carousel 8.6.0](https://www.embla-carousel.com/) — MIT;
  `js/embla-carousel.LICENSE`.
- [model-viewer 4.4.0](https://modelviewer.dev/) — Apache-2.0;
  `js/model-viewer.LICENSE`.
- Natural Earth map geometry is public domain; source details are in
  `data/README.md`. Company and institution marks belong to their owners.
