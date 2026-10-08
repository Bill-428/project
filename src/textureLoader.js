// textureLoader.js —— 纹理预加载管理器
// 批量加载所有外部纹理，加载完成后再启动场景，避免首帧闪烁
import * as THREE from 'three';
const DEFAULT_ANISOTROPY = 8;
function applyOptions(texture, opts = {}) {
  const {
    wrapS = THREE.ClampToEdgeWrapping,
    wrapT = THREE.ClampToEdgeWrapping,
    repeat = null,
    minFilter = THREE.LinearMipmapLinearFilter,
    magFilter = THREE.LinearFilter,
    colorSpace = THREE.SRGBColorSpace,
    anisotropy = DEFAULT_ANISOTROPY,
  } = opts;
  texture.wrapS = wrapS;
  texture.wrapT = wrapT;
  if (repeat) texture.repeat.set(repeat[0], repeat[1]);
  texture.minFilter = minFilter;
  texture.magFilter = magFilter;
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}
export function loadTextures(config, renderer = null) {
  const loader = new THREE.TextureLoader();
  const entries = Object.entries(config);
  const maxAniso = renderer ? renderer.capabilities.getMaxAnisotropy() : DEFAULT_ANISOTROPY;
  const promises = entries.map(([key, val]) => {
    const path = typeof val === 'string' ? val : val.path;
    const opts = typeof val === 'string' ? {} : { ...val };
    if (opts.anisotropy === undefined) opts.anisotropy = maxAniso;
    return new Promise((resolve) => {
      loader.load(
        path,
        (tex) => {
          applyOptions(tex, opts);
          resolve([key, tex]);
        },
        undefined,
        (err) => {
          console.warn(`[textureLoader] 加载失败: ${path}`, err);
          resolve([key, null]);
        }
      );
    });
  });
  return Promise.all(promises).then((results) => {
    const map = {};
    for (const [key, tex] of results) map[key] = tex;
    return map;
  });
}
export function getTexture(map, key) {
  return map[key] || null;
}
export function disposeTextures(map) {
  for (const key of Object.keys(map)) {
    if (map[key]) map[key].dispose();
  }
}
