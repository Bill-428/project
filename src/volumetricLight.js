import * as THREE from 'three';
export function createVolumetricLight(scene, options = {}) {
    const {
        rayCount = 6, color = 0xc9bcff, opacity = 0.18,
        rayWidth = 14, rayHeight = 110,
        lightDir = new THREE.Vector3(25, 35, 20)
    } = options;
    const dir = lightDir.clone().normalize();
    const rays = [];
    const groundY = -0.3;
    const spread = 55 + rayCount * 14;
    function createRayTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.12, 'rgba(255,255,255,0.10)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.40)');
        grad.addColorStop(0.8, 'rgba(255,255,255,0.75)');
        grad.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 256);
        return new THREE.CanvasTexture(canvas);
    }
    const rayTexture = createRayTexture();
    for (let i = 0; i < rayCount; i++) {
        const sx = (Math.random() - 0.5) * spread;
        const skyY = 38 + Math.random() * 32;
        const sz = (Math.random() - 0.5) * spread;
        const len = Math.min((skyY - groundY) / dir.y, rayHeight);
        const gx = sx - dir.x * len, gz = sz - dir.z * len;
        const topR = rayWidth * (0.10 + Math.random() * 0.07);
        const botR = rayWidth * (0.025 + Math.random() * 0.025);
        const geo = new THREE.CylinderGeometry(topR, botR, len, 16, 1, true);
        geo.translate(0, -len / 2, 0);
        const mat = new THREE.MeshBasicMaterial({
            map: rayTexture, color: color, transparent: true,
            opacity: opacity * (0.65 + Math.random() * 0.55),
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        const ray = new THREE.Mesh(geo, mat);
        ray.position.set(sx, skyY, sz);
        ray.lookAt(new THREE.Vector3(gx, groundY, gz));
        ray.userData = { baseOpacity: mat.opacity, phase: Math.random() * Math.PI * 2 };
        scene.add(ray);
        rays.push(ray);
    }
    const api = {
        setColor(hex) { rays.forEach(r => r.material.color.setHex(hex)); },
        setOpacity(v) { rays.forEach((r, i) => { r.material.opacity = v * (0.65 + (i % 3) * 0.18); r.userData.baseOpacity = r.material.opacity; }); },
        update(delta, time) {
            rays.forEach(r => {
                const pulse = 0.80 + Math.sin(time * 0.4 + r.userData.phase) * 0.20;
                r.material.opacity = r.userData.baseOpacity * pulse;
            });
        },
        dispose() {
            rays.forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.map?.dispose(); r.material.dispose(); });
        }
    };
    return api;
}
