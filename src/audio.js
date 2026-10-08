// audio.js —— 音频管理模块
// 双层 BGM（bgm.wav + bgm2.mp3 同时播放）+ 音效 + 音量控制
let audioCtx = null;
let bgmSource1 = null;   // bgm.wav
let bgmSource2 = null;   // bgm2.mp3
let bgmGain = null;
let sfxGain = null;
let bgmVolume = 0.7;
let sfxVolume = 0.8;
let bgmPlaying = false;
let initialized = false;

// 音频文件路径（文件放在 public/audio/ 目录下）
const AUDIO_PATHS = {
    bgm: '/audio/bgm.wav',
    bgm2: '/audio/bgm2.mp3',
    buttonClick: '/audio/button-click.wav',
    collect: '/audio/collect.wav',
    groupComplete: '/audio/group-complete.wav'
};

// 已加载的音频 buffer 缓存
const bufferCache = new Map();

export function initAudio() {
    if (initialized) return;
    // AudioContext 必须在用户交互后创建（浏览器自动播放策略）
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = bgmVolume;
    bgmGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = sfxVolume;
    sfxGain.connect(audioCtx.destination);
    initialized = true;
    console.log('✅ 音频系统初始化完成');
}

// 加载音频文件并解码
async function loadAudio(name) {
    if (bufferCache.has(name)) return bufferCache.get(name);
    const path = AUDIO_PATHS[name];
    if (!path) {
        console.warn(`[audio] 未找到音频配置: ${name}`);
        return null;
    }
    try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioCtx.decodeAudioData(arrayBuffer);
        bufferCache.set(name, buffer);
        console.log(`🎵 音频加载成功: ${name} (${path})`);
        return buffer;
    } catch (e) {
        console.error(`[audio] 加载失败: ${name} (${path})`, e);
        return null;
    }
}

// 播放双层 BGM（bgm.wav + bgm2.mp3 同时循环播放）
export async function playBGM() {
    if (!initialized || bgmPlaying) return;

    // 并行加载两个 BGM
    const [buffer1, buffer2] = await Promise.all([
        loadAudio('bgm'),
        loadAudio('bgm2')
    ]);

    // 第一层 BGM
    if (buffer1) {
        bgmSource1 = audioCtx.createBufferSource();
        bgmSource1.buffer = buffer1;
        bgmSource1.loop = true;
        bgmSource1.connect(bgmGain);
        bgmSource1.start();
    }

    // 第二层 BGM
    if (buffer2) {
        bgmSource2 = audioCtx.createBufferSource();
        bgmSource2.buffer = buffer2;
        bgmSource2.loop = true;
        bgmSource2.connect(bgmGain);
        bgmSource2.start();
    }

    bgmPlaying = true;
    console.log('🎵 双层 BGM 开始播放');
}

export function stopBGM() {
    if (bgmSource1) {
        try { bgmSource1.stop(); } catch (e) { /* 已停止 */ }
        bgmSource1.disconnect();
        bgmSource1 = null;
    }
    if (bgmSource2) {
        try { bgmSource2.stop(); } catch (e) { /* 已停止 */ }
        bgmSource2.disconnect();
        bgmSource2 = null;
    }
    bgmPlaying = false;
}

export function pauseBGM() {
    if (audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend();
    }
}

export function resumeBGM() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// 播放音效（buttonClick / collect / groupComplete）
export async function playSFX(name) {
    if (!initialized) return;
    const buffer = await loadAudio(name);
    if (!buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGain);
    source.start();
}

export function setBGMVolume(v) {
    bgmVolume = Math.max(0, Math.min(1, v));
    if (bgmGain) bgmGain.gain.value = bgmVolume;
}

export function setSFXVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    if (sfxGain) sfxGain.gain.value = sfxVolume;
}

export function getBGMVolume() { return bgmVolume; }
export function getSFXVolume() { return sfxVolume; }
export function isAudioInitialized() { return initialized; }
export function isBGMPlaying() { return bgmPlaying; }
