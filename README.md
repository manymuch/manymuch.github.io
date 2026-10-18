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
- `js/loading.js`: previews settle first, then full media downloads one at a time
  in page order. A popup interrupts unrelated background work; its images can
  use two foreground slots. Background loading resumes when they arrive.
- `js/co2-model.js`: the same cached loader supplies the hosted GLB and viewer
  script, with a persistent poster, bounded initialization, and retry.
- `js/smart-home.js`: optional live statistics refresh near that section;
  checked-in charts remain visible when APIs are blocked or unavailable.

Phones intentionally use a 1280-pixel desktop viewport with pinch zoom enabled.
There is no mobile drawer or separate portrait reading layout. Animations use
WebP, with still posters for reduced motion. Galleries advance every three
seconds and pause for interaction, hidden pages, and open media dialogs.

## Section links and media loading

Canonical links are `#employment`, `#education`, `#publications`, `#community`,
and `#personal-projects`. Old `#one`, `#two`, `#three`, and `#building` links
normalize with `replaceState`; zero-height anchors also support them without JS.
Navigation remains native, including Back/Forward and active-section tracking.

The preview barrier includes selected animation previews and model posters.
Visible and nearby carousel images get priority. Each preview settles on load,
error, or a 20-second deadline. Automatic full-size downloads then follow DOM
order, including the conference video and local viewer script/GLB. Full assets
stay compressed as blobs until opened; page previews are never replaced.

`SiteLoading.asset(url, {kind, foreground})` returns a shared promise for a
cached resource URL. URLs resolve against the document base, retaining queries.
`foreground(owner, requests)` atomically replaces an interaction's request set;
`release(owner)` returns unfinished requests to their original background order.
A request already in flight is promoted without restarting. Other background
transfers are aborted and later restarted. Foreground requests allow two
transfers; background uses one. Optional statistics run after pending media.

Transfer deadlines begin on dispatch: 60 seconds for media/scripts, 90 seconds
for the GLB. Failed assets do not block the queue; opening or retrying creates a
fresh attempt. Popups keep their previews and show loading/retry feedback.
The viewer script executes its cached blob once. Blob URLs live for the page's
lifetime, survive back/forward caching, and are revoked on final page discard.

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
queue concurrency, cancellation/resumption, foreground promotion, rapid request
changes, retry/deadlines, query-sensitive deduplication, blob/script reuse,
back/forward cache cleanup, legacy navigation, and preview fallback. JavaScript can also be
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

The media-loader update was additionally checked in Chromium using a local
fault/throttling server. All 29 selected previews completed before the first
automatic full-media request. Opening a board photo interrupted a throttled CAD
download, served the photo, and resumed CAD while the dialog remained open.
Cached reopening used blob URLs; a forced image failure retained its preview and
recovered through Retry. A forced GLB failure also recovered without downloading
the viewer script twice. Canonical/legacy URLs, reload, Back/Forward, no-script
anchors, dark dialog backgrounds, and muted IROS playback were checked locally.
The dependency-free runtime suite covers deadlines, rapid request changes,
two-part figures, already-running promotion, corrupt-resource invalidation,
optional API isolation, and blob lifetime across back/forward caching.

## Attribution

- Original visual layout: [Read Only by HTML5 UP](https://html5up.net/read-only),
  adapted under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- [Embla Carousel 8.6.0](https://www.embla-carousel.com/) — MIT;
  `js/embla-carousel.LICENSE`.
- [model-viewer 4.4.0](https://modelviewer.dev/) — Apache-2.0;
  `js/model-viewer.LICENSE`.
- Natural Earth map geometry is public domain; source details are in
  `data/README.md`. Company and institution marks belong to their owners.
