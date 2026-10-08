import * as THREE from 'three';
const lights = {
  ambient: null,
  hemisphere: null,
  directional: null,
  fill: null,
  pointLights: [],
  spotLights: [],
};
export function createLights(scene) {
  // 环境光（提亮暗部，夜晚/黄昏树不死黑）
  const ambient = new THREE.AmbientLight(0xb9a8f5, 1.4);
  scene.add(ambient);
  lights.ambient = ambient;
  // 半球光：暖天 + 大地色地面（增强朦胧梦幻感）
  const hemi = new THREE.HemisphereLight(0x9a8ee0, 0x2a1f52, 1.1);
  scene.add(hemi);
  lights.hemisphere = hemi;
  // 主光：暖金色"夕阳"
  const dir = new THREE.DirectionalLight(0xc9bcff, 1.35);
  dir.position.set(30, 40, 20);
  dir.castShadow = true;
  scene.add(dir);
  lights.directional = dir;
  // 补光（背面补光，暗部带暖色，增强梦幻感）
  const fill = new THREE.DirectionalLight(0x7a6ae0, 0.6);
  fill.position.set(-28, 14, -22);
  scene.add(fill);
  lights.fill = fill;
  return lights;
}
export function setLightColor(lightName, color, intensity) {
  const light = lights[lightName];
  if (light) {
    if (color) light.color.set(color);
    if (intensity !== undefined) light.intensity = intensity;
  }
}
export function addPointLight(scene, color, intensity, distance, position) {
  const light = new THREE.PointLight(color, intensity, distance);
  light.position.copy(position);
  scene.add(light);
  lights.pointLights.push(light);
  return light;
}
export function addSpotLight(scene, color, intensity, distance, angle, position, target) {
  const light = new THREE.SpotLight(color, intensity, distance, angle);
  light.position.copy(position);
  light.target.position.copy(target);
  scene.add(light);
  scene.add(light.target);
  lights.spotLights.push(light);
  return light;
}
export function clearLights(scene) {
  lights.pointLights.forEach(l => scene.remove(l));
  lights.spotLights.forEach(l => { scene.remove(l); scene.remove(l.target); });
  lights.pointLights = [];
  lights.spotLights = [];
}
