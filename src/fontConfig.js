// fontConfig.js —— 全局字体统一配置
// 所有文字的字体、颜色、大小、位置都在这里调整
// ============================================================

export const FONT_CONFIG = {
  // ---------- 字体文件 ----------
  fontUrl: '/fonts/BeiBanChuanSuiXinTi-2.ttf',
  fontFamily: '"BeiBanChuanSuiXinTi", "Ma Shan Zheng", "ZCOOL XiaoWei", "Songti SC", serif',

  // ========== UI 层文字（ui.js） ==========
  ui: {
    // 通关标题"记忆已完整"
    gameoverTitle: {
      fontSize: '36px',
      color: '#f0dcb4',
      letterSpacing: '8px',
      textShadow: '0 0 20px rgba(212,168,72,0.5)',
    },
    // 碎片收集文案浮层
    fragmentText: {
      fontSize: '22px',
      color: '#f0dcb4',
      top: '25%',              // 垂直位置
      letterSpacing: '4px',
      lineHeight: '2',
      textShadow: '0 0 20px rgba(212,168,72,0.7), 0 0 40px rgba(212,168,72,0.4)',
    },
    // 进度 HUD（"第 X 幕"）
    progressHud: {
      fontSize: '999px',
      color: 'rgba(200,180,140,0.7)',
      top: '24px',
      letterSpacing: '2px',
    },
    // 返回原点提示
    returnHint: {
      fontSize: '26px',
      color: 'rgba(240,220,180,0.8)',
      bottom: '80px',
      letterSpacing: '4px',
      textShadow: '0 0 15px rgba(212,168,72,0.5)',
    },
    // 暂停面板音量标签
    volumeLabel: {
      fontSize: '24px',
      color: 'rgba(200,180,140,0.85)',
      letterSpacing: '2px',
    },
  },

  // ========== 过场动画文字（cutscene.js，Canvas 绘制） ==========
  cutscene: {
    fontSize: 84,               // Canvas 字号
    fontWeight: '400',
    fillColor: 'rgba(240, 220, 180, 0.95)',   // 文字填充色
    strokeColor: 'rgba(212, 168, 72, 0.6)',   // 描边色
    strokeWidth: 1.5,
    shadowColor: 'rgba(212, 168, 72, 0.8)',   // 发光色
    shadowBlur: 20,
    lineHeight: 56,
    spriteWidth: 20,            // 3D 空间中文字精灵宽度
    spriteHeight: 5,
    riseHeight: 4.0,            // 从水面升起的高度
  },

  // ========== 场景内提示文字（hint.js） ==========
  hint: {
    fontSize: '32px',
    color: '#fff',
    textShadow: '0 0 30px rgba(0,0,0,0.9), 0 0 60px rgba(255,180,0,0.3)',
    textOffsetPx: 50,           // 文字底部距锚点的像素偏移
  },
};

/**
 * 注入 @font-face，在 main.js 入口调用一次即可
 */
export function injectFontFace() {
  if (document.getElementById('font-face-injected')) return;
  const style = document.createElement('style');
  style.id = 'font-face-injected';
  style.textContent = `
    @font-face {
      font-family: 'BeiBanChuanSuiXinTi';
      src: url('${FONT_CONFIG.fontUrl}') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}
