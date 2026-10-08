import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // ⚙️【湖岸环波浪范围】smoothstep(0.0, 0.5, vUv.x) 中的 0.5
    //    vUv.x=0 是内圈(水边)，=1 是外圈(陆地)
    //    调大(如0.8) → 波浪向陆地侧延伸更远
    //    调小(如0.3) → 波浪只在最内圈
    float waveMask = 1.0 - smoothstep(0.0, 0.5, vUv.x);

    // ⚙️【湖岸环起伏振幅】* 0.015
    //    调大湖岸环上下浮动更明显，调小更平
    pos.y += sin(pos.x * 1.5 + pos.z * 1.2 + uTime * 0.4) * 0.015 * waveMask;

    vPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uWaterColor;
  uniform vec3 uLandColor;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    float t = smoothstep(0.0, 1.0, vUv.x);

    // ⚙️【湖岸环内圈颜色】接水面边缘描边，浅蓝白色
    vec3 innerCol = vec3(0.82, 0.92, 0.98);
    // ⚙️【湖岸环中间色】柔和蓝色，内圈到外圈的过渡色
    vec3 midCol   = vec3(0.45, 0.70, 0.88);

    // ⚙️【内圈→中间色的过渡位置】smoothstep(0.0, 0.4, t) 中的 0.4
    //    调大(如0.6) → 内圈颜色占比更多，过渡更靠外
    vec3 color = mix(innerCol, midCol, smoothstep(0.0, 0.4, t));

    // ⚙️【湖岸环波纹强度】* 0.025
    float waveMask = 1.0 - t;
    float ripple = sin(vPosition.x * 6.0 + vPosition.z * 4.5 + uTime * 0.8) * 0.025;
    color += ripple * waveMask * vec3(0.3, 0.5, 0.7);

    // ⚙️【湖岸环透明度】mix(0.85, 0.0, smoothstep(0.25, 1.0, t))
    //    0.85 → 内圈不透明度，调大更不透明，调小更透明
    //    0.25 → 从哪里开始淡出，调大淡出更晚（不透明区域更大）
    float alpha = mix(0.85, 0.0, smoothstep(0.25, 1.0, t));

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createShoreMaterial(waterColor = '#91d4db', landColor = '#423789') {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:       { value: 0 },
      uWaterColor: { value: new THREE.Color(waterColor) },
      uLandColor:  { value: new THREE.Color(landColor) }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
