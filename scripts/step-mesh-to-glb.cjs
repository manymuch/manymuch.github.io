// Convert occt-import-js mesh JSON to glTF 2.0, retaining STEP face colors.
// Usage: node scripts/step-mesh-to-glb.cjs mesh.json model.glb [materials.json]
const fs = require('fs');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!input.success || !input.meshes.length) throw new Error('Empty or invalid STEP import');
const finishes = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8')) : { profiles: {}, meshes: {} };
const gltf = {
  asset: { version: '2.0', generator: 'STEP / occt-import-js 0.0.23' },
  scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [],
  buffers: [{ byteLength: 0 }], bufferViews: [], accessors: []
};
const chunks = [];
let offset = 0;
function accessor(array, type, componentType, target, bounds) {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const view = gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target }) - 1;
  const padding = (4 - bytes.length % 4) % 4;
  chunks.push(bytes, Buffer.alloc(padding)); offset += bytes.length + padding;
  return gltf.accessors.push({ bufferView: view, componentType, count: array.length / (type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1), type, ...bounds }) - 1;
}
function texture(path) {
  const bytes = fs.readFileSync(path), padding = (4 - bytes.length % 4) % 4;
  const view = gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length }) - 1;
  chunks.push(bytes, Buffer.alloc(padding)); offset += bytes.length + padding;
  gltf.images ||= []; gltf.textures ||= [];
  gltf.samplers ||= [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  const image = gltf.images.push({ bufferView: view, mimeType: 'image/png' }) - 1;
  return gltf.textures.push({ source: image, sampler: 0 }) - 1;
}
const materialMap = new Map();
function material(color, profile) {
  const finish = finishes.profiles[profile];
  if (finish) color = finish.color;
  const key = profile || color.map(c => c.toFixed(4)).join(',');
  if (!materialMap.has(key)) {
    // STEP stores sRGB display colors; glTF material factors use linear RGB.
    const linear = color.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    const pbr = { baseColorFactor: [...linear, 1], metallicFactor: finish ? finish.metallic : .15, roughnessFactor: finish ? finish.roughness : .52 };
    if (finish?.texture) pbr.baseColorTexture = { index: texture(finish.texture) };
    const index = gltf.materials.push({ name: finish ? profile : 'STEP ' + key, pbrMetallicRoughness: pbr, doubleSided: true }) - 1;
    materialMap.set(key, index);
  }
  return materialMap.get(key);
}
let minAll = [Infinity, Infinity, Infinity], maxAll = [-Infinity, -Infinity, -Infinity];
input.meshes.forEach(mesh => {
  const p = mesh.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const v = [p[i] / 1000, p[i + 2] / 1000, -p[i + 1] / 1000];
    v.forEach((n, axis) => { minAll[axis] = Math.min(minAll[axis], n); maxAll[axis] = Math.max(maxAll[axis], n); });
  }
});
const center = minAll.map((n, i) => (n + maxAll[i]) / 2);
let triangles = 0;
const merged = new Map();
input.meshes.forEach((mesh, meshIndex) => {
  const p = mesh.attributes.position.array, normal = mesh.attributes.normal?.array;
  const positions = new Float32Array(p.length), normals = normal && new Float32Array(normal.length);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    const v = [p[i] / 1000, p[i + 2] / 1000, -p[i + 1] / 1000];
    v.forEach((n, axis) => {
      positions[i + axis] = n - center[axis];
      min[axis] = Math.min(min[axis], positions[i + axis]); max[axis] = Math.max(max[axis], positions[i + axis]);
    });
    if (normals) { normals[i] = normal[i]; normals[i + 1] = normal[i + 2]; normals[i + 2] = -normal[i + 1]; }
  }
  const finish = finishes.meshes[meshIndex];
  const defaultMaterial = material(mesh.color || [.55, .55, .55], finish?.profile);
  const faceMaterials = new Int32Array(mesh.index.array.length / 3).fill(defaultMaterial);
  (mesh.brep_faces || []).forEach(face => {
    if (face.color && !finish) faceMaterials.fill(material(face.color), face.first, face.last + 1);
  });
  if (finish?.goldTriangles) finish.goldTriangles.forEach(index => { faceMaterials[index] = material(null, 'gold'); });
  Object.entries(finish?.triangleProfiles || {}).forEach(([profile, indices]) => {
    indices.forEach(index => { faceMaterials[index] = material(null, profile); });
  });
  const groups = new Map();
  faceMaterials.forEach((mat, i) => {
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat).push(...mesh.index.array.slice(i * 3, i * 3 + 3));
  });
  groups.forEach((indices, mat) => {
    if (!merged.has(mat)) merged.set(mat, { positions: [], normals: [], indices: [], uv: [] });
    const group = merged.get(mat), remap = new Map();
    indices.forEach(index => {
      if (!remap.has(index)) {
        remap.set(index, group.positions.length / 3);
        group.positions.push(...positions.slice(index * 3, index * 3 + 3));
        group.normals.push(...(normals ? normals.slice(index * 3, index * 3 + 3) : [0, 1, 0]));
        if (finish?.uv) {
          const b = finish.uv, x = p[index * 3], y = p[index * 3 + 1];
          group.uv.push((b.right - (x - .01) / 32.18 * (b.right-b.left)) / b.width, (b.bottom - (y - .01) / 32.18 * (b.bottom-b.top)) / b.height);
        }
      }
      group.indices.push(remap.get(index));
    });
    triangles += indices.length / 3;
  });
});
merged.forEach((group, mat) => {
  const positions = new Float32Array(group.positions), normals = new Float32Array(group.normals);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  positions.forEach((n, i) => { min[i % 3] = Math.min(min[i % 3], n); max[i % 3] = Math.max(max[i % 3], n); });
  const attributes = { POSITION: accessor(positions, 'VEC3', 5126, 34962, { min, max }), NORMAL: accessor(normals, 'VEC3', 5126, 34962) };
  if (group.uv.length) attributes.TEXCOORD_0 = accessor(new Float32Array(group.uv), 'VEC2', 5126, 34962);
  const large = positions.length / 3 > 65535;
  const indices = large ? new Uint32Array(group.indices) : new Uint16Array(group.indices);
  const model = gltf.meshes.push({ name: 'PCB material ' + mat, primitives: [{ attributes, indices: accessor(indices, 'SCALAR', large ? 5125 : 5123, 34963), material: mat }] }) - 1;
  gltf.scenes[0].nodes.push(gltf.nodes.push({ mesh: model }) - 1);
});
gltf.buffers[0].byteLength = offset;
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const binary = Buffer.concat(chunks);
const header = Buffer.alloc(12); header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(json.length); jsonHeader.write('JSON', 4);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(process.argv[3], Buffer.concat([header, jsonHeader, json, binHeader, binary]));
console.log(JSON.stringify({ meshes: gltf.meshes.length, materials: gltf.materials.length, triangles, bytes: fs.statSync(process.argv[3]).size, dimensionsMm: maxAll.map((n, i) => (n - minAll[i]) * 1000) }));
