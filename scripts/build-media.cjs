/* Optional asset tooling: npm install --no-save sharp, then node scripts/build-media.cjs.
   The published site needs no Node runtime or build step. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
async function render(source, output) {
  let svg = await fs.readFile(path.join(root, source), 'utf8');
  const refs = [...svg.matchAll(/href="([^"#][^"]+)"/g)];
  for (const [, ref] of refs) {
    if (ref.startsWith('data:')) continue;
    const file = path.resolve(root, path.dirname(source), ref);
    const ext = path.extname(file).slice(1).replace('jpg', 'jpeg');
    svg = svg.replaceAll(`href="${ref}"`, `href="data:image/${ext};base64,${(await fs.readFile(file)).toString('base64')}"`);
  }
  await sharp(Buffer.from(svg)).webp({ quality: 94, effort: 6 }).toFile(path.join(root, output));
}
async function main() {
  await render('scripts/media-sources/doc-overview.svg', 'images/doc-overview.webp');
  await sharp(path.join(root, 'images/doc-overview.webp')).resize({ width: 960 }).webp({ quality: 88, effort: 6 }).toFile(path.join(root, 'images/doc-overview-preview.webp'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
