import * as THREE from 'three';
function createPetalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(24, 24, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,175,205,0.85)');
    g.addColorStop(0.75, 'rgba(230,120,170,0.45)');
    g.addColorStop(1, 'rgba(200,90,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(32, 32, 13, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(210,110,150,0.5)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(32, 32); ctx.quadraticCurveTo(34, 20, 32, 12);
    ctx.moveTo(32, 32); ctx.quadraticCurveTo(22, 26, 16, 22);
    ctx.moveTo(32, 32); ctx.quadraticCurveTo(42, 26, 48, 22);
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
}
export function createPetals(scene, options = {}) {
    const {
        count = 100, color = 0xffb8d8, spread = 120,
        minHeight = 12, maxHeight = 45, fallSpeed = 1.5,
        swayAmount = 3, swaySpeed = 0.8,
        terrainHeight = null, landStayTime = 4.0, lakes = []
    } = options;
    const petalGeo = new THREE.PlaneGeometry(0.7, 0.9);
    const petalMat = new THREE.MeshBasicMaterial({
        map: createPetalTexture(), color, transparent: true, opacity: 0.8,
        side: THREE.DoubleSide, depthWrite: false
    });
    const instancedMesh = new THREE.InstancedMesh(petalGeo, petalMat, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.renderOrder = 5;
    scene.add(instancedMesh);
    const petals = [];
    const dummy = new THREE.Object3D();
    let frameCount = 0;
    function getGroundY(x, z) {
        if (terrainHeight) return terrainHeight(x, z, lakes) + 0.15;
        return 0.15;
    }
    function resetPetal(p, randomY = false) {
        p.x = (Math.random() - 0.5) * spread * 2;
        p.z = (Math.random() - 0.5) * spread * 2;
        p.y = randomY ? minHeight + Math.random() * (maxHeight - minHeight) : maxHeight + Math.random() * 10;
        p.fallSpeed = fallSpeed * (0.6 + Math.random() * 0.8);
        p.swayOffset = Math.random() * Math.PI * 2;
        p.swayAmount = swayAmount * (0.5 + Math.random());
        p.rotSpeed = (Math.random() - 0.5) * 2;
        p.rotX = Math.random() * Math.PI;
        p.rotY = Math.random() * Math.PI;
        p.scale = 0.6 + Math.random() * 0.8;
        p.landed = false;
        p.landTimer = 0;
        p.fadeOut = false;
        p.opacity = 1.0;
    }
    for (let i = 0; i < count; i++) {
        const p = {};
        resetPetal(p, true);
        petals.push(p);
    }
    petals.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rotX, p.rotY, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
    const api = {
        setColor(hex) { petalMat.color.setHex(hex); },
        setOpacity(v) { petalMat.opacity = Math.max(0, Math.min(1, v)); },
        setCount(n) { instancedMesh.count = Math.min(n, count); },
        update(delta, time) {
            petals.forEach((p) => {
                if (p.landed) {
                    // 落地状态：停留 + 淡出
                    p.landTimer += delta;
                    if (p.landTimer > landStayTime) p.fadeOut = true;
                    if (p.fadeOut) {
                        p.opacity -= delta * 0.5;
                        if (p.opacity <= 0) { resetPetal(p, false); return; }
                    }
                    // 落地后轻微贴地旋转
                    p.rotX = Math.PI / 2 + Math.sin(time * 0.5 + p.swayOffset) * 0.1;
                    p.rotY += delta * 0.1;
                } else {
                    // 飘落状态
                    p.y -= p.fallSpeed * delta;
                    const sway = Math.sin(time * swaySpeed + p.swayOffset) * p.swayAmount * delta;
                    p.x += sway;
                    p.rotX += p.rotSpeed * delta;
                    p.rotY += p.rotSpeed * 0.7 * delta;
                    // 检测落地
                    const groundY = getGroundY(p.x, p.z);
                    if (p.y <= groundY) {
                        p.y = groundY;
                        p.landed = true;
                        p.landTimer = 0;
                    }
                }
            });
            frameCount++;
            if (frameCount % 2 === 0) {
                petals.forEach((p, i) => {
                    dummy.position.set(p.x, p.y, p.z);
                    dummy.rotation.set(p.rotX, p.rotY, 0);
                    dummy.scale.setScalar(p.scale * (p.landed ? 0.85 : 1));
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i, dummy.matrix);
                });
                instancedMesh.instanceMatrix.needsUpdate = true;
            }
        },
        dispose() {
            scene.remove(instancedMesh);
            petalGeo.dispose(); petalMat.map?.dispose(); petalMat.dispose();
        }
    };
    return api;
}
