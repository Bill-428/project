// ui.js —— 游戏 UI 覆盖层（PNG 图片版 + 统一字体配置 + 开场跳过按钮）
import { FONT_CONFIG } from './fontConfig.js';

const UI_CONFIG = {
  basePath: '/ui/',
  title: {
    src: 'title.png',
    width: 1020,
    top: '28%',
    offsetX: 0,
    offsetY: -230,
  },
  startBtn: {
    src: 'start-btn.png',
    width: 250,
    top: '58%',
    offsetX: 0,
    offsetY: 50,
  },
  pauseBtn: {
    src: 'pause-btn.png',
    width: 90,
    top: 20,
    right: 24,
  },
  skipBtn: {
    src: 'skip.png',
    width: 140,
    bottom: 24,
    right: 24,
  },
  pausePanel: {
    src: 'pause-panel.png',
    width: 720,
    offsetX: 0,
    offsetY: 30,
    volumeTop: 295,
    volumeLeft: 120,
    volumeWidth: 440,
    resumeTop: 430,
    resumeWidth: 200,
  },
  resumeBtn: { src: 'resume-btn.png', width: 200 },
  restartBtn: { src: 'restart-btn.png', width: 200 },
  chapters: [
    { src: 'chapter-1.png', width: 860, top: '35%', offsetX: -45, offsetY: -120 },
    { src: 'chapter-2.png', width: 860, top: '35%', offsetX: -25, offsetY: -270 },
    { src: 'chapter-3.png', width: 860, top: '35%', offsetX: -10, offsetY: -300 },
    { src: 'chapter-4.png', width: 860, top: '35%', offsetX: -30, offsetY: -150 },
    { src: 'chapter-5.png', width: 860, top: '35%', offsetX: -25, offsetY: -180 },
  ],
  stageTitle: {
    top: '35%',
    offsetX: -45,
    offsetY: -120,
  },
  hoverTilt: -3,
  hoverScale: 1.04,
  clickScale: 0.96,
  shakeDuration: 350,
};

const STAGE_TITLE_MAP = [
  '第一幕 · 接纳自我',
  '第二幕 · 与过去和解',
  '第三幕 · 当下的力量',
  '第四幕 · 自我疗愈',
  '第五幕 · 重生完整',
];

const FF = FONT_CONFIG.fontFamily;
const U = FONT_CONFIG.ui;

export function createUI(callbacks = {}) {
  const bp = UI_CONFIG.basePath;
  const C = UI_CONFIG;

  const style = document.createElement('style');
  style.textContent = `
    .game-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; pointer-events: none;
      background: radial-gradient(ellipse at center, rgba(20,15,35,0.75) 0%, rgba(10,8,20,0.92) 100%);
    }
    .menu-content {
      position: absolute; inset: 0;
      pointer-events: none;
    }
    .menu-item {
      position: absolute; left: 50%;
      pointer-events: auto;
    }
    .ui-title-img {
      display: block; user-select: none; -webkit-user-drag: none;
      pointer-events: none;
    }
    .ui-btn-img {
      cursor: pointer;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: center center;
      user-select: none;
      -webkit-user-drag: none;
      display: block;
    }
    .ui-btn-img:hover {
      transform: rotate(${C.hoverTilt}deg) scale(${C.hoverScale});
    }
    .ui-btn-img:active {
      transform: rotate(0deg) scale(${C.clickScale});
    }
    @keyframes uiBtnShake {
      0%   { transform: rotate(0deg) scale(1); }
      20%  { transform: rotate(-5deg) scale(0.97); }
      40%  { transform: rotate(4deg) scale(0.98); }
      60%  { transform: rotate(-3deg) scale(0.99); }
      80%  { transform: rotate(1.5deg) scale(1); }
      100% { transform: rotate(0deg) scale(1); }
    }
    .ui-btn-img.shake {
      animation: uiBtnShake ${C.shakeDuration}ms ease;
    }
    .pause-panel-wrap {
      position: absolute;
      left: 50%; top: 50%;
      pointer-events: auto;
    }
    .pause-panel-img {
      display: block;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }
    .pause-volume-group {
      position: absolute;
      display: flex; flex-direction: column; gap: 16px;
    }
    .pause-volume-row {
      display: flex; align-items: center; gap: 12px;
      font-family: ${FF};
      font-size: ${U.volumeLabel.fontSize};
      color: ${U.volumeLabel.color};
      letter-spacing: ${U.volumeLabel.letterSpacing};
    }
    .pause-volume-row label { width: 72px; text-align: right; }
    .pause-volume-slider {
      flex: 1;
      -webkit-appearance: none; appearance: none;
      height: 3px; background: rgba(212,168,72,0.3); outline: none; cursor: pointer;
      border-radius: 2px;
    }
    .pause-volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 14px; height: 14px; border-radius: 50%;
      background: #d4a848; cursor: pointer;
      box-shadow: 0 0 8px rgba(212,168,72,0.6);
    }
    .pause-volume-slider::-moz-range-thumb {
      width: 14px; height: 14px; border-radius: 50%;
      background: #d4a848; border: none; cursor: pointer;
      box-shadow: 0 0 8px rgba(212,168,72,0.6);
    }
    .pause-volume-value {
      width: 30px; text-align: right; color: #d4a848;
      font-family: monospace; font-size: 13px;
    }
    #in-game-pause-btn {
      position: fixed; z-index: 1001;
      padding: 0; border: none; background: transparent;
      pointer-events: auto;
    }
    #in-game-pause-btn img {
      display: block;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: center center;
      cursor: pointer;
      user-select: none; -webkit-user-drag: none;
    }
    #in-game-pause-btn:hover img {
      transform: rotate(${C.hoverTilt}deg) scale(${C.hoverScale});
    }
    #in-game-pause-btn:active img {
      transform: rotate(0deg) scale(${C.clickScale});
    }
    #in-game-pause-btn.shake img {
      animation: uiBtnShake ${C.shakeDuration}ms ease;
    }
    #intro-skip-btn {
      position: fixed; z-index: 1002;
      padding: 0; border: none; background: transparent;
      pointer-events: auto;
      display: none;
    }
    #intro-skip-btn img {
      display: block;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform-origin: center center;
      cursor: pointer;
      user-select: none; -webkit-user-drag: none;
    }
    #intro-skip-btn:hover img {
      transform: rotate(${C.hoverTilt}deg) scale(${C.hoverScale});
    }
    #intro-skip-btn:active img {
      transform: rotate(0deg) scale(${C.clickScale});
    }
    #intro-skip-btn.shake img {
      animation: uiBtnShake ${C.shakeDuration}ms ease;
    }
    .gameover-content {
      display: flex; flex-direction: column; align-items: center;
      pointer-events: auto; gap: 40px;
    }
    .gameover-title {
      font-family: ${FF};
      font-size: ${U.gameoverTitle.fontSize};
      font-weight: 300;
      color: ${U.gameoverTitle.color};
      margin: 0;
      letter-spacing: ${U.gameoverTitle.letterSpacing};
      text-shadow: ${U.gameoverTitle.textShadow};
    }
    .fragment-text {
      position: fixed; top: ${U.fragmentText.top}; left: 50%; transform: translateX(-50%);
      font-family: ${FF};
      font-size: ${U.fragmentText.fontSize};
      color: ${U.fragmentText.color};
      text-align: center;
      letter-spacing: ${U.fragmentText.letterSpacing};
      line-height: ${U.fragmentText.lineHeight};
      text-shadow: ${U.fragmentText.textShadow};
      opacity: 0; transition: opacity 0.5s; pointer-events: none; z-index: 999;
      white-space: pre-line;
    }
    .fragment-text.visible { opacity: 1; }
    .progress-hud {
      position: fixed; top: ${U.progressHud.top}; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 16px; z-index: 998;
      font-family: ${FF};
      font-size: ${U.progressHud.fontSize};
      color: ${U.progressHud.color};
      letter-spacing: ${U.progressHud.letterSpacing};
    }
    .progress-dots { display: flex; gap: 8px; }
    .progress-dots .dot {
      width: 20px; height: 20px; border-radius: 50%;
      background: rgba(212,168,72,0.25); border: 1px solid rgba(212,168,72,0.4);
      transition: all 0.3s;
    }
    .progress-dots .dot.filled {
      background: #d4a848; border-color: #d4a848;
      box-shadow: 0 0 10px rgba(212,168,72,0.7);
    }
    .return-hint {
      position: fixed; bottom: ${U.returnHint.bottom}; left: 50%; transform: translateX(-50%);
      font-family: ${FF};
      font-size: ${U.returnHint.fontSize};
      color: ${U.returnHint.color};
      letter-spacing: ${U.returnHint.letterSpacing};
      text-shadow: ${U.returnHint.textShadow};
      opacity: 0; transition: opacity 0.5s; pointer-events: none; z-index: 998;
    }
    .return-hint.visible { opacity: 1; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
    .light-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, rgba(255,240,200,0.9) 0%, rgba(255,220,150,0.7) 50%, rgba(212,168,72,0.5) 100%);
      opacity: 0; pointer-events: none; z-index: 997; transition: opacity 0.3s;
    }
    .stage-title {
      position: fixed; left: 50%;
      opacity: 0; transition: opacity 0.8s; pointer-events: none; z-index: 999;
      display: flex; align-items: center; justify-content: center;
    }
    .stage-title.visible { opacity: 1; }
    .stage-title img {
      display: block; user-select: none; -webkit-user-drag: none;
      filter: drop-shadow(0 0 20px rgba(212,168,72,0.5));
    }
  `;
  document.head.appendChild(style);

  function bindBtnShake(el, callback) {
    el.addEventListener('click', () => {
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), C.shakeDuration + 20);
      callback?.();
    });
  }

  const menuOverlay = document.createElement('div');
  menuOverlay.id = 'menu-overlay';
  menuOverlay.className = 'game-overlay';
  menuOverlay.innerHTML = `
    <div class="menu-content">
      <div class="menu-item" style="top:${C.title.top}; transform:translate(calc(-50% + ${C.title.offsetX}px), ${C.title.offsetY}px);">
        <img class="ui-title-img" src="${bp}${C.title.src}" style="width:${C.title.width}px;">
      </div>
      <div class="menu-item" style="top:${C.startBtn.top}; transform:translate(calc(-50% + ${C.startBtn.offsetX}px), ${C.startBtn.offsetY}px);">
        <img class="ui-btn-img" id="start-btn" src="${bp}${C.startBtn.src}" style="width:${C.startBtn.width}px;">
      </div>
    </div>
  `;

  const pauseOverlay = document.createElement('div');
  pauseOverlay.id = 'pause-overlay';
  pauseOverlay.className = 'game-overlay';
  pauseOverlay.innerHTML = `
    <div class="pause-panel-wrap" style="width:${C.pausePanel.width}px; transform:translate(calc(-50% + ${C.pausePanel.offsetX}px), calc(-50% + ${C.pausePanel.offsetY}px));">
      <img class="pause-panel-img" src="${bp}${C.pausePanel.src}" style="width:${C.pausePanel.width}px;">
      <div class="pause-volume-group" style="top:${C.pausePanel.volumeTop}px; left:${C.pausePanel.volumeLeft}px; width:${C.pausePanel.volumeWidth}px;">
        <div class="pause-volume-row">
          <label for="bgm-volume">音乐</label>
          <input type="range" id="bgm-volume" class="pause-volume-slider" min="0" max="100" value="70">
          <span class="pause-volume-value" id="bgm-value">70</span>
        </div>
        <div class="pause-volume-row">
          <label for="sfx-volume">音效</label>
          <input type="range" id="sfx-volume" class="pause-volume-slider" min="0" max="100" value="80">
          <span class="pause-volume-value" id="sfx-value">80</span>
        </div>
      </div>
      <img class="ui-btn-img" id="resume-btn" src="${bp}${C.resumeBtn.src}"
        style="width:${C.pausePanel.resumeWidth}px; position:absolute; top:${C.pausePanel.resumeTop}px; left:50%; transform:translateX(-50%);">
    </div>
  `;

  const gameoverOverlay = document.createElement('div');
  gameoverOverlay.id = 'gameover-overlay';
  gameoverOverlay.className = 'game-overlay';
  gameoverOverlay.innerHTML = `
    <div class="gameover-content">
      <h2 class="gameover-title">记忆已完整</h2>
      <img class="ui-btn-img" id="restart-btn" src="${bp}${C.restartBtn.src}" style="width:${C.restartBtn.width}px;">
    </div>
  `;

  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'in-game-pause-btn';
  pauseBtn.title = '暂停';
  pauseBtn.style.top = C.pauseBtn.top + 'px';
  pauseBtn.style.right = C.pauseBtn.right + 'px';
  pauseBtn.innerHTML = `<img src="${bp}${C.pauseBtn.src}" style="width:${C.pauseBtn.width}px;">`;

  const skipBtn = document.createElement('button');
  skipBtn.id = 'intro-skip-btn';
  skipBtn.title = '跳过开场';
  skipBtn.style.bottom = C.skipBtn.bottom + 'px';
  skipBtn.style.right = C.skipBtn.right + 'px';
  skipBtn.innerHTML = `<img src="${bp}${C.skipBtn.src}" style="width:${C.skipBtn.width}px;">`;

  const fragmentText = document.createElement('div');
  fragmentText.id = 'fragment-text';
  fragmentText.className = 'fragment-text';

  const progressHud = document.createElement('div');
  progressHud.id = 'progress-hud';
  progressHud.className = 'progress-hud';
  progressHud.innerHTML = `
    <span class="stage-label">第 <span id="stage-num">1</span> 幕</span>
    <span class="progress-dots" id="progress-dots"></span>
  `;

  const returnHint = document.createElement('div');
  returnHint.id = 'return-hint';
  returnHint.className = 'return-hint';
  returnHint.textContent = '跟随箭头，返回原点';

  const lightOverlay = document.createElement('div');
  lightOverlay.id = 'light-overlay';
  lightOverlay.className = 'light-overlay';

  const stageTitle = document.createElement('div');
  stageTitle.id = 'stage-title';
  stageTitle.className = 'stage-title';
  stageTitle.style.top = C.stageTitle.top;
  stageTitle.style.transform = `translate(calc(-50% + ${C.stageTitle.offsetX}px), ${C.stageTitle.offsetY}px)`;
  stageTitle.innerHTML = `<img id="stage-title-img" src="" alt="">`;

  document.body.appendChild(menuOverlay);
  document.body.appendChild(pauseOverlay);
  document.body.appendChild(gameoverOverlay);
  document.body.appendChild(pauseBtn);
  document.body.appendChild(skipBtn);
  document.body.appendChild(fragmentText);
  document.body.appendChild(progressHud);
  document.body.appendChild(returnHint);
  document.body.appendChild(lightOverlay);
  document.body.appendChild(stageTitle);

  const startBtn = menuOverlay.querySelector('#start-btn');
  const resumeBtn = pauseOverlay.querySelector('#resume-btn');
  const restartBtn = gameoverOverlay.querySelector('#restart-btn');
  const bgmVolume = pauseOverlay.querySelector('#bgm-volume');
  const sfxVolume = pauseOverlay.querySelector('#sfx-volume');
  const bgmValue = pauseOverlay.querySelector('#bgm-value');
  const sfmValue = pauseOverlay.querySelector('#sfx-value');
  const stageNum = progressHud.querySelector('#stage-num');
  const progressDots = progressHud.querySelector('#progress-dots');
  const stageTitleImg = stageTitle.querySelector('#stage-title-img');

  bindBtnShake(startBtn, () => callbacks.onStart?.());
  bindBtnShake(resumeBtn, () => callbacks.onResume?.());
  bindBtnShake(restartBtn, () => callbacks.onRestart?.());
  bindBtnShake(pauseBtn, () => callbacks.onPause?.());
  bindBtnShake(skipBtn, () => callbacks.onSkip?.());

  bgmVolume.addEventListener('input', () => {
    bgmValue.textContent = bgmVolume.value;
    callbacks.onBgmVolume?.(bgmVolume.value / 100);
  });
  sfxVolume.addEventListener('input', () => {
    sfmValue.textContent = sfxVolume.value;
    callbacks.onSfxVolume?.(sfxVolume.value / 100);
  });

  let textTimer = null;
  let titleTimer = null;

  const api = {
    showMenu() {
      menuOverlay.style.display = 'flex';
      pauseBtn.style.display = 'none';
      progressHud.style.display = 'none';
    },
    hideMenu() { menuOverlay.style.display = 'none'; },
    showPause() { pauseOverlay.style.display = 'flex'; },
    hidePause() { pauseOverlay.style.display = 'none'; },
    showGameover() {
      gameoverOverlay.style.display = 'flex';
      pauseBtn.style.display = 'none';
      progressHud.style.display = 'none';
    },
    hideGameover() { gameoverOverlay.style.display = 'none'; },
    showPauseBtn() { pauseBtn.style.display = 'block'; },
    hidePauseBtn() { pauseBtn.style.display = 'none'; },
    showSkipBtn() { skipBtn.style.display = 'block'; },
    hideSkipBtn() { skipBtn.style.display = 'none'; },
    showProgress() { progressHud.style.display = 'flex'; },
    hideProgress() { progressHud.style.display = 'none'; },
    updateProgress(stage, collected) {
      stageNum.textContent = stage + 1;
      let dots = '';
      for (let i = 0; i < 3; i++) {
        dots += `<span class="dot ${i < collected ? 'filled' : ''}"></span>`;
      }
      progressDots.innerHTML = dots;
    },
    showFragmentText(text, duration = 2800) {
      if (textTimer) clearTimeout(textTimer);
      fragmentText.textContent = text;
      fragmentText.classList.add('visible');
      textTimer = setTimeout(() => fragmentText.classList.remove('visible'), duration);
    },
    showReturnHint() { returnHint.classList.add('visible'); },
    hideReturnHint() { returnHint.classList.remove('visible'); },
    setLightOverlay(opacity) {
      lightOverlay.style.opacity = Math.max(0, Math.min(1, opacity));
    },
    showStageTitle(title, duration = 2500) {
      if (titleTimer) clearTimeout(titleTimer);
      let idx = -1;
      if (typeof title === 'number') {
        idx = title;
      } else {
        idx = STAGE_TITLE_MAP.indexOf(title);
      }
      if (idx >= 0 && idx < C.chapters.length) {
        const ch = C.chapters[idx];
        const top = ch.top ?? C.stageTitle.top;
        const offsetX = ch.offsetX ?? C.stageTitle.offsetX;
        const offsetY = ch.offsetY ?? C.stageTitle.offsetY;
        stageTitle.style.top = top;
        stageTitle.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
        stageTitleImg.src = bp + ch.src;
        stageTitleImg.style.width = ch.width + 'px';
        stageTitleImg.style.display = '';
      } else {
        stageTitleImg.style.display = 'none';
      }
      stageTitle.classList.add('visible');
      titleTimer = setTimeout(() => stageTitle.classList.remove('visible'), duration);
    },
    getBgmVolume() { return bgmVolume.value / 100; },
    getSfxVolume() { return sfxVolume.value / 100; },
    dispose() {
      if (textTimer) clearTimeout(textTimer);
      if (titleTimer) clearTimeout(titleTimer);
      menuOverlay.remove();
      pauseOverlay.remove();
      gameoverOverlay.remove();
      pauseBtn.remove();
      skipBtn.remove();
      fragmentText.remove();
      progressHud.remove();
      returnHint.remove();
      lightOverlay.remove();
      stageTitle.remove();
      style.remove();
    },
  };

  api.showMenu();
  pauseOverlay.style.display = 'none';
  gameoverOverlay.style.display = 'none';
  progressHud.style.display = 'none';
  returnHint.classList.remove('visible');
  lightOverlay.style.opacity = '0';
  skipBtn.style.display = 'none';
  return api;
}
