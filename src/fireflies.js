import * as THREE from 'three';
let sharedGlowTexture = null;
function getGlowTexture() {
    if (sharedGlowTexture) return sharedGlowTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,240,180,1)');
    g.addColorStop(0.5, 'rgba(255,200,80,0.8)');
    g.addColorStop(0.8, 'rgba(200,150,50,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    sharedGlowTexture = new THREE.CanvasTexture(canvas);
    return sharedGlowTexture;
}
const vertexShader = `
    attribute float aOpacity; attribute float aScale; attribute vec3 aColor;
    varying float vOpacity; varying vec3 vColor; varying vec2 vUv;
    void main() {
        vOpacity = aOpacity; vColor = aColor; vUv = uv;
        vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 scl = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec3 toCam = cameraPosition - instPos.xyz;
        float camLen = length(toCam);
        vec3 camDir = camLen > 0.001 ? toCam / camLen : vec3(0.0, 0.0, 1.0);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), camDir));
        vec3 up = cross(camDir, right);
        vec3 worldPos = instPos.xyz + right * position.x * scl.x * aScale + up * position.y * scl.y * aScale;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
`;
const fragmentShader = `
    uniform sampler2D uMap; varying float vOpacity; varying vec3 vColor; varying vec2 vUv;
    void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.01) discard;
        gl_FragColor = vec4(vColor * tex.rgb, tex.a * vOpacity);
    }
`;
class FireflyGroup {
    constructor(scene, count = 5, options = {}) {
        this.group = new THREE.Group();
        this.count = count;
        this.fireflies = [];
        const baseColor = options.color ? new THREE.Color(options.color) : new THREE.Color(0xffaa33);
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.ShaderMaterial({
            uniforms: { uMap: { value: getGlowTexture() } },
            vertexShader, fragmentShader, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(this.mesh);
        this.opacities = new Float32Array(count);
        this.scales = new Float32Array(count).fill(1);
        this.colors = new Float32Array(count * 3);
        this.scatterX = new Float32Array(count);
        this.scatterZ = new Float32Array(count);
        this.scatterY = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (options.radius || 8);
            this.fireflies.push({
                baseX: Math.cos(angle) * dist, baseZ: Math.sin(angle) * dist,
                phase: i / count + Math.random() * 0.1,
                speedFactor: 0.7 + Math.random() * 0.6,
                maxHeight: options.maxHeight || 12, riseSpeed: options.riseSpeed || 0.4,
                sizeMin: options.sizeMin || 0.3, sizeMax: options.sizeMax || 1.2,
                wobbleAmplitude: options.wobbleAmplitude || 0.8,
                wobbleFrequency: options.wobbleFrequency || 1.2,
                x: 0, y: 0, z: 0, opacity: 0, scale: 1
            });
            this.colors[i * 3] = baseColor.r;
            this.colors[i * 3 + 1] = baseColor.g;
            this.colors[i * 3 + 2] = baseColor.b;
        }
        this.opacityAttr = new THREE.InstancedBufferAttribute(this.opacities, 1);
        this.scaleAttr = new THREE.InstancedBufferAttribute(this.scales, 1);
        this.colorAttr = new THREE.InstancedBufferAttribute(this.colors, 3);
        this.mesh.geometry.setAttribute('aOpacity', this.opacityAttr);
        this.mesh.geometry.setAttribute('aScale', this.scaleAttr);
        this.mesh.geometry.setAttribute('aColor', this.colorAttr);
        this._dummy = new THREE.Object3D();
        this._scatterRadius = options.scatterRadius || 10;
        this._scatterStrength = options.scatterStrength || 6;
        scene.add(this.group);
    }
    setPosition(x, y, z) { this.group.position.set(x, y, z); }
    // characterPos: 世界坐标；萤火虫在半径内受惊散开
    update(delta, time, characterPos = null) {
        const groupPos = this.group.position;
        let scareAmount = 0;
        let scareDirX = 0, scareDirZ = 0;
        if (characterPos) {
            const dx = groupPos.x - characterPos.x, dz = groupPos.z - characterPos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < this._scatterRadius) {
                scareAmount = 1 - dist / this._scatterRadius;
                const inv = 1 / Math.max(dist, 0.01);
                scareDirX = dx * inv; scareDirZ = dz * inv;
            }
        }
        for (let i = 0; i < this.count; i++) {
            const f = this.fireflies[i];
            f.phase += delta * f.riseSpeed * f.speedFactor * 0.08;
            if (f.phase > 1) {
                f.phase -= 1;
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 8;
                f.baseX = Math.cos(angle) * dist;
                f.baseZ = Math.sin(angle) * dist;
            }
            const p = f.phase;
            const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            const wobX = Math.sin(p * Math.PI * 2 * f.wobbleFrequency + time * 0.5) * f.wobbleAmplitude;
            const wobZ = Math.cos(p * Math.PI * 2 * f.wobbleFrequency * 0.7 + time * 0.4) * f.wobbleAmplitude;
            // 受惊散开：平滑趋近散开偏移
            const targetSX = scareDirX * scareAmount * this._scatterStrength * (0.5 + (i % 3) * 0.3);
            const targetSZ = scareDirZ * scareAmount * this._scatterStrength * (0.5 + ((i + 1) % 3) * 0.3);
            const targetSY = scareAmount * 3 * (0.5 + (i % 2) * 0.5);
            const dampRate = Math.min(1, delta * 2.5);
            this.scatterX[i] += (targetSX - this.scatterX[i]) * dampRate;
            this.scatterZ[i] += (targetSZ - this.scatterZ[i]) * dampRate;
            this.scatterY[i] += (targetSY - this.scatterY[i]) * dampRate;
            f.x = f.baseX + wobX + this.scatterX[i];
            f.z = f.baseZ + wobZ + this.scatterZ[i];
            f.y = eased * f.maxHeight + this.scatterY[i];
            let opacity = 0;
            if (p < 0.2) opacity = p / 0.2;
            else if (p < 0.8) opacity = 1;
            else opacity = 1 - (p - 0.8) / 0.2;
            // 受惊时更亮（加速闪烁）
            const flickerSpeed = 1 + scareAmount * 2;
            const flicker = 0.75 + 0.25 * Math.sin(p * 50 * flickerSpeed + time * 2);
            f.opacity = opacity * flicker * (1 + scareAmount * 0.3);
            const baseScale = f.sizeMin + (f.sizeMax - f.sizeMin) * opacity;
            const breathe = 0.8 + 0.2 * Math.sin(p * Math.PI * 4 + time * 1.5);
            f.scale = baseScale * breathe * (1 + scareAmount * 0.2);
            this._dummy.position.set(f.x, f.y, f.z);
            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this._dummy.matrix);
            this.opacities[i] = Math.min(1, f.opacity);
            this.scales[i] = f.scale;
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.opacityAttr.needsUpdate = true;
        this.scaleAttr.needsUpdate = true;
    }
    dispose(scene) {
        scene.remove(this.group);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.fireflies = [];
    }
}
export function createFireflies(scene, options = {}) {
    const count = options.count || 5;
    return new FireflyGroup(scene, count, options);
}
