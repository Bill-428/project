// floatingObjects.js —— 湖面漂浮物（莲花 + 发光水藻），基于实际湖面分布
import * as THREE from 'three';

function pointInPolygon(x, z, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, zi = pts[i].z;
        const xj = pts[j].x, zj = pts[j].z;
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
}

// 生成莲花纹理：六片花瓣 + 中心花蕊
function createLotusTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const px = 64 + Math.cos(ang) * 16;
        const py = 64 + Math.sin(ang) * 16;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        const g = ctx.createLinearGradient(0, -18, 0, 14);
        g.addColorStop(0, 'rgba(255,120,170,0.95)');
        g.addColorStop(0.6, 'rgba(255,185,215,0.85)');
        g.addColorStop(1, 'rgba(255,235,248,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,222,120,0.95)';
    ctx.beginPath(); ctx.arc(64, 64, 7, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

// 生成发光水藻纹理
function createAlgaeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(140,255,190,0.95)');
    grad.addColorStop(0.4, 'rgba(90,225,155,0.5)');
    grad.addColorStop(1, 'rgba(60,200,130,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = 'rgba(120,255,180,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.quadraticCurveTo(32 + Math.cos(a) * 16, 32 + Math.sin(a) * 16, 32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28);
        ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

export function createFloatingObjects(scene, lakeShores, options = {}) {
    const {
        lotusCount = 12,
        algaeCount = 20,
        floatSpeed = 0.8,
        floatAmount = 0.15
    } = options;

    function randomPointInShore(shore) {
        const pts = shore.points;
        const bbox = shore.bbox;
        for (let t = 0; t < 60; t++) {
            const x = bbox.minX + Math.random() * (bbox.maxX - bbox.minX);
            const z = bbox.minZ + Math.random() * (bbox.maxZ - bbox.minZ);
            if (!pointInPolygon(x, z, pts)) continue;
            let minD = Infinity;
            for (const p of pts) {
                const d = Math.hypot(x - p.x, z - p.z);
                if (d < minD) minD = d;
            }
            if (minD > 0.8 && minD < shore.maxR * 0.85) return { x, z };
        }
        const p = pts[Math.floor(Math.random() * pts.length)];
        return {
            x: shore.cx + (p.x - shore.cx) * 0.7,
            z: shore.cz + (p.z - shore.cz) * 0.7
        };
    }

    const objects = [];
    const lotusTex = createLotusTexture();
    const lotusMat = new THREE.MeshBasicMaterial({
        map: lotusTex,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const lotusGeo = new THREE.CircleGeometry(1.2, 16);
    lotusGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < lotusCount; i++) {
        const shore = lakeShores[i % lakeShores.length];
        const pos = randomPointInShore(shore);
        const lotus = new THREE.Mesh(lotusGeo, lotusMat);
        lotus.position.set(pos.x, -0.1, pos.z);
        lotus.rotation.y = Math.random() * Math.PI;
        lotus.scale.setScalar(0.5 + Math.random() * 0.7);
        scene.add(lotus);
        objects.push({ mesh: lotus, baseY: -0.1, phase: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.3 });
    }

    const algaeTex = createAlgaeTexture();
    const algaeMat = new THREE.SpriteMaterial({
        map: algaeTex,
        color: 0x80ffb4,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    for (let i = 0; i < algaeCount; i++) {
        const shore = lakeShores[i % lakeShores.length];
        const pos = randomPointInShore(shore);
        const algae = new THREE.Sprite(algaeMat);
        algae.position.set(pos.x, 0.05 + Math.random() * 0.3, pos.z);
        algae.scale.setScalar(1.4 + Math.random() * 2.2);
        scene.add(algae);
        objects.push({ mesh: algae, baseY: algae.position.y, phase: Math.random() * Math.PI * 2, rotSpeed: 0, isAlgae: true });
    }

    const api = {
        update(delta, time) {
            for (const obj of objects) {
                obj.mesh.position.y = obj.baseY + Math.sin(time * floatSpeed + obj.phase) * floatAmount;
                if (obj.rotSpeed) obj.mesh.rotation.y += obj.rotSpeed * delta;
                if (obj.isAlgae) obj.mesh.material.opacity = 0.4 + Math.sin(time * 1.5 + obj.phase) * 0.25;
            }
        },
        setLotusColor(hex) {
            objects.forEach(obj => { if (!obj.isAlgae) obj.mesh.material.color.setHex(hex); });
        },
        dispose() {
            objects.forEach(obj => {
                scene.remove(obj.mesh);
                if (obj.mesh.geometry) obj.mesh.geometry.dispose();
                if (obj.mesh.material) {
                    if (obj.mesh.material.map) obj.mesh.material.map.dispose();
                    obj.mesh.material.dispose();
                }
            });
        }
    };
    return api;
}
