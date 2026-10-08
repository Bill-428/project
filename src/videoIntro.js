// videoIntro.js —— 开场视频动画（替代 inkDropIntro）
// 全屏 CSS 覆盖层 + object-fit: contain，画面不变形，空余部分黑色填充
export function createVideoIntro(options = {}) {
  const { src = '/video/intro.mp4' } = options;

  // 全屏容器，黑色背景
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #000; z-index: 999; display: none;
  `;

  const video = document.createElement('video');
  video.src = src;
  video.loop = false;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.style.cssText = `
    width: 100%; height: 100%; object-fit: contain;
    background: #000; display: block;
  `;

  container.appendChild(video);
  document.body.appendChild(container);

  let active = false;
  let onCompleteCallback = null;

  video.addEventListener('ended', () => {
    if (active) finish();
  });

  function finish() {
    active = false;
    container.style.display = 'none';
    video.pause();
    const cb = onCompleteCallback;
    onCompleteCallback = null;
    cb?.();
  }

  function start(onComplete) {
    onCompleteCallback = onComplete;
    active = true;
    container.style.display = 'block';
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('[videoIntro] 视频播放失败，直接进入过场:', err);
        finish();
      });
    }
  }

  function skip() {
    if (!active) return;
    finish();
  }

  function update(delta) {
    // CSS 视频不需要每帧更新，保留接口以统一调用
  }

  function reset() {
    active = false;
    container.style.display = 'none';
    video.pause();
    video.currentTime = 0;
    onCompleteCallback = null;
  }

  function dispose() {
    container.remove();
    video.pause();
    video.src = '';
  }

  return {
    start,
    skip,
    update,
    reset,
    dispose,
    isActive: () => active
  };
}
