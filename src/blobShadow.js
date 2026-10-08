// blobShadow.js —— 底部圆形扩散阴影（Contact Shadow / Blob Shadow）
// 用径向渐变纹理代替实时阴影贴图，保证清晰、无锯齿、无闪烁
import * as THREE from 'three';

let shadowTexture = null;

/**
 * 生成径向渐变阴影纹理（中心深、边缘透明）
 * 只生成一次，全局复用
 */
function getShadowTexture() {
  if (shadowTexture) return shadowTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 径向渐变：中心不透明 → 边缘完全透明
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0.0, 'rgba(0, 0, 0, 1.0)');
  gradient.addColorStop(0.35, 'rgba(0, 0, 0, 0.85)');
  gradient.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
  gradient.addColorStop(0.85, 'rgba(0, 0, 0, 0.15)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  shadowTexture = new THREE.CanvasTexture(canvas);
  shadowTexture.needsUpdate = true;
  // 关键：关闭 mipmap，使用线性过滤，避免远距离闪烁和雪花
  shadowTexture.generateMipmaps = false;
  shadowTexture.minFilter = THREE.LinearFilter;
  shadowTexture.magFilter = THREE.LinearFilter;
  shadowTexture.wrapS = THREE.ClampToEdgeWrapping;
  shadowTexture.wrapT = THREE.ClampToEdgeWrapping;
  shadowTexture.colorSpace = THREE.SRGBColorSpace;

  return shadowTexture;
}

/**
 * 创建一个圆形扩散阴影平面
 * @param {Object} options
 * @param {number} options.radius - 阴影半径（世界单位）
 * @param {number} options.opacity - 阴影不透明度 0~1
 * @param {string} options.color - 阴影颜色，默认黑色
 * @param {number} options.yOffset - 距离地面的高度偏移，防止 z-fighting
 * @returns {THREE.Mesh} 阴影平面 Mesh
 */
export function createBlobShadow({
  radius = 2,
  opacity = 0.5,
  color = '#000000',
  yOffset = 0.02
} = {}) {
  const texture = getShadowTexture();

  const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geometry.rotateX(-Math.PI / 2); // 水平放置

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: new THREE.Color(color),
    transparent: true,
    opacity: opacity,
    depthWrite: false,          // 关键：不写入深度，避免 z-fighting
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,        // 关键：多边形偏移，进一步避免闪烁
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = yOffset;
  mesh.renderOrder = 1;         // 在地面之后渲染
  mesh.userData.isBlobShadow = true;
  mesh.userData.baseOpacity = opacity;
  mesh.userData.baseRadius = radius;

  return mesh;
}

/**
 * 为物体创建并附加一个跟随阴影（用于角色等移动物体）
 * 返回 { mesh, update(targetPosition, groundY, scaleMul, opacityMul) }
 */
export function createFollowShadow({
  radius = 1.5,
  opacity = 0.55,
  color = '#000000',
  yOffset = 0.02
} = {}) {
  const mesh = createBlobShadow({ radius, opacity, color, yOffset });
  mesh.visible = true;

  /**
   * 每帧更新阴影位置和大小
   * @param {THREE.Vector3} targetPos - 跟随目标的世界坐标
   * @param {number} groundY - 地面高度
   * @param {number} scaleMul - 大小缩放系数（跳跃时变小）
   * @param {number} opacityMul - 透明度系数（跳跃时变浅）
   */
  function update(targetPos, groundY = 0, scaleMul = 1, opacityMul = 1) {
    mesh.position.x = targetPos.x;
    mesh.position.z = targetPos.z;
    mesh.position.y = groundY + yOffset;
    const baseR = mesh.userData.baseRadius;
    mesh.scale.setScalar(scaleMul);
    // 缩放后几何尺寸变化，保持中心对齐（PlaneGeometry 已居中，无需额外偏移）
    mesh.material.opacity = mesh.userData.baseOpacity * opacityMul;
    mesh.visible = opacityMul > 0.01;
  }

  function dispose() {
    mesh.geometry.dispose();
    mesh.material.dispose();
    if (mesh.parent) mesh.parent.remove(mesh);
  }

  return { mesh, update, dispose };
}

/**
 * 批量为一组物体创建静态阴影（石头、树等）
 * @param {THREE.Object3D} parent - 场景或组
 * @param {Array} items -  [{ position: Vector3, radius, opacity, color? }]
 */
export function createStaticShadows(parent, items) {
  const group = new THREE.Group();
  group.name = 'blob-shadows';
  for (const item of items) {
    const shadow = createBlobShadow({
      radius: item.radius,
      opacity: item.opacity,
      color: item.color || '#000000',
      yOffset: item.yOffset || 0.02,
    });
    shadow.position.x = item.position.x;
    shadow.position.z = item.position.z;
    shadow.position.y = (item.position.y || 0) + 0.02;
    if (item.rotationY) shadow.rotation.y = item.rotationY;
    group.add(shadow);
  }
  parent.add(group);
  return group;
}
