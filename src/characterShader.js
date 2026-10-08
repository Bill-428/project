import * as THREE from 'three';
const vertexShader = `
  varying vec3 vNormal; varying vec3 vPosition; varying vec2 vUv;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPosition = worldPos.xyz; vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;
const fragmentShader = `
  varying vec3 vNormal; varying vec3 vPosition; varying vec2 vUv;
  uniform vec3 uBaseColor; uniform vec3 uLightDir; uniform float uTime;
  uniform vec3 uFogColor; uniform float uFogDensity;
  uniform vec3 uEnvTop; uniform vec3 uEnvBottom;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 lightDir = normalize(uLightDir);
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float diff = dot(vNormal, lightDir) * 0.5 + 0.5;
    float diffuse = smoothstep(0.1, 0.9, diff);
    float ambient = 0.35;
    vec3 backLightDir = normalize(-lightDir + vec3(0.3, 0.1, 0.2));
    float backDiff = dot(vNormal, backLightDir) * 0.5 + 0.5;
    float fillLight = smoothstep(0.1, 0.7, backDiff) * 0.25;
    float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float edgeGlow = smoothstep(0.2, 0.75, fresnel) * 0.7;
    float sss = smoothstep(0.0, 0.35, 1.0 - diff) * 0.5;
    vec3 sssColor = vec3(1.0, 0.6, 0.3);
    vec3 shadowColor = vec3(0.55, 0.35, 0.28);
    vec3 midColor = vec3(0.83, 0.65, 0.55);
    vec3 lightColor = vec3(1.0, 0.92, 0.82);
    float t = diffuse;
    vec3 baseColor = mix(shadowColor, midColor, smoothstep(0.2, 0.6, t));
    baseColor = mix(baseColor, lightColor, smoothstep(0.5, 0.9, t));
    baseColor *= uBaseColor;
    float totalLight = ambient + diffuse * 0.65 + fillLight;
    vec3 finalColor = baseColor * totalLight;
    finalColor += vec3(1.0, 0.75, 0.45) * edgeGlow * 0.6;
    finalColor += sssColor * sss * 0.4;
    // ===== 环境反射（基于反射方向的渐变近似，零贴图开销）=====
    vec3 reflDir = reflect(-viewDir, vNormal);
    float envT = smoothstep(-0.3, 0.9, reflDir.y);
    vec3 envColor = mix(uEnvBottom, uEnvTop, envT);
    finalColor = mix(finalColor, envColor, fresnel * 0.25);
    float noise = hash(vUv * 80.0 + uTime * 0.008) * 0.05;
    finalColor += noise;
    float vignette = 1.0 - length(vUv - 0.5) * 0.15;
    finalColor *= vignette;
    finalColor = mix(finalColor, finalColor * vec3(1.05, 0.98, 0.92), 0.3);
    // ===== 雾效（FogExp2，与地面/水面统一）=====
    float camDist = length(vPosition - cameraPosition);
    float fogF = 1.0 - exp(-(uFogDensity * camDist) * (uFogDensity * camDist));
    finalColor = mix(finalColor, uFogColor, clamp(fogF, 0.0, 1.0));
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
export function createCharacterMaterial(
  baseColor = '#f5e6d3',
  lightDir = new THREE.Vector3(20, 40, 20),
  fogColor = new THREE.Color(0x40347a),
  fogDensity = 0.011,
  envTop = new THREE.Color(0x6a5ca8),
  envBottom = new THREE.Color(0x1a1438)
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColor) },
      uLightDir: { value: lightDir.clone().normalize() },
      uTime: { value: 0 },
      uFogColor: { value: fogColor },
      uFogDensity: { value: fogDensity },
      uEnvTop: { value: envTop },
      uEnvBottom: { value: envBottom },
    }, vertexShader, fragmentShader,
  });
}
