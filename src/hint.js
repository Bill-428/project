// hint.js —— 场景内文字提示（统一字体配置版）
import * as THREE from 'three';
import { FONT_CONFIG } from './fontConfig.js';

const H = FONT_CONFIG.hint;
const FF = FONT_CONFIG.fontFamily;

export function createHint(config) {
    const {
        anchorPos = new THREE.Vector3(0, 0, 0),
        triggerRadius = 15,
        text = '占位文本',
        textOffsetPx = H.textOffsetPx,
        fadeSpeed = 0.8,
        color = H.color,
        fontSize = H.fontSize,
        textShadow = H.textShadow
    } = config;

    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
        position: 'fixed',
        fontFamily: FF,
        color: color,
        fontSize: fontSize,
        fontWeight: '700',
        textShadow: textShadow,
        opacity: '0',
        transition: 'opacity 0.6s ease',
        pointerEvents: 'none',
        zIndex: '100',
        transform: 'translate(-50%, -100%)',
        left: '0px',
        top: '0px',
        lineHeight: '1.4',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        userSelect: 'none',
    });
    document.body.appendChild(el);

    let hintOpacity = 0;
    const worldPos = new THREE.Vector3();

    function update(camera, manPosition) {
        const dist = manPosition.distanceTo(anchorPos);
        const inRange = dist < triggerRadius;
        const targetOpacity = inRange ? 1 : 0;
        hintOpacity += (targetOpacity - hintOpacity) * fadeSpeed;
        hintOpacity = Math.max(0, Math.min(1, hintOpacity));

        worldPos.copy(anchorPos);
        worldPos.project(camera);
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        const screenX = worldPos.x * halfWidth + halfWidth;
        const screenY = -(worldPos.y * halfHeight) + halfHeight;

        el.style.left = screenX + 'px';
        el.style.top = (screenY - textOffsetPx) + 'px';
        el.style.opacity = hintOpacity > 0.01 ? hintOpacity : 0;
        return { inRange, opacity: hintOpacity };
    }

    function dispose() {
        if (el.parentNode) {
            document.body.removeChild(el);
        }
    }

    return { el, update, dispose };
}
