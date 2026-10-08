// textureConfig.js —— 所有外部纹理的路径与参数配置
// 修改路径或纹理参数只需改这里
import * as THREE from 'three';
export const TEXTURE_CONFIG = {
  // ===== 草（黑白灰 alpha mask，着色器染色）=====
  grass1: { path: '/textures/grass/grass1.png', colorSpace: THREE.NoColorSpace },
  grass2: { path: '/textures/grass/grass2.png', colorSpace: THREE.NoColorSpace },
  grass3: { path: '/textures/grass/grass3.png', colorSpace: THREE.NoColorSpace },
  // ===== 花 =====
  // flower1 黑白灰，着色器染色；flower2-4 彩色直接使用
  flower1: { path: '/textures/flowers/flower1.png', colorSpace: THREE.NoColorSpace },
  flower2: { path: '/textures/flowers/flower2.png', colorSpace: THREE.SRGBColorSpace },
  flower3: { path: '/textures/flowers/flower3.png', colorSpace: THREE.SRGBColorSpace },
  flower4: { path: '/textures/flowers/flower4.png', colorSpace: THREE.SRGBColorSpace },
  // ===== 芦苇（黑白灰 alpha mask，着色器染色）=====
  reed1: { path: '/textures/reeds/reed1.png', colorSpace: THREE.NoColorSpace },
  reed2: { path: '/textures/reeds/reed2.png', colorSpace: THREE.NoColorSpace },
  // ===== 地面（黑白灰，可重复平铺，着色器染色）=====
  ground: {
    path: '/textures/ground/ground.png',
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    repeat: [1, 1],
    colorSpace: THREE.NoColorSpace,
  },
  // ===== 碎片（白色，保持原色，加法发光）=====
  'chapter1-debris1': { path: '/textures/fragments/chapter1-debris1.png' },
  'chapter1-debris2': { path: '/textures/fragments/chapter1-debris2.png' },
  'chapter1-debris3': { path: '/textures/fragments/chapter1-debris3.png' },
  'chapter2-debris1': { path: '/textures/fragments/chapter2-debris1.png' },
  'chapter2-debris2': { path: '/textures/fragments/chapter2-debris2.png' },
  'chapter2-debris3': { path: '/textures/fragments/chapter2-debris3.png' },
  'chapter3-debris1': { path: '/textures/fragments/chapter3-debris1.png' },
  'chapter3-debris2': { path: '/textures/fragments/chapter3-debris2.png' },
  'chapter3-debris3': { path: '/textures/fragments/chapter3-debris3.png' },
  'chapter4-debris1': { path: '/textures/fragments/chapter4-debris1.png' },
  'chapter4-debris2': { path: '/textures/fragments/chapter4-debris2.png' },
  'chapter4-debris3': { path: '/textures/fragments/chapter4-debris3.png' },
  'chapter5-debris1': { path: '/textures/fragments/chapter5-debris1.png' },
  'chapter5-debris2': { path: '/textures/fragments/chapter5-debris2.png' },
  'chapter5-debris3': { path: '/textures/fragments/chapter5-debris3.png' },
  returnArrow: { path: '/textures/ui/return-arrow.png', colorSpace: THREE.SRGBColorSpace },
};
