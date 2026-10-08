// gameState.js —— 游戏状态机
// 状态：MENU(菜单) → INTRO(开场动画) → PLAYING(游戏中) → PAUSED(暂停) → TRANSITIONING(场景过渡) → GAMEOVER(结束)

export const GameState = {
    MENU: 'MENU',
    INTRO: 'INTRO',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    TRANSITIONING: 'TRANSITIONING',
    GAMEOVER: 'GAMEOVER'
};

let currentState = GameState.MENU;
const listeners = [];

export function getState() {
    return currentState;
}

export function setState(newState) {
    if (newState === currentState) return;
    const oldState = currentState;
    currentState = newState;
    listeners.forEach(fn => fn(newState, oldState));
}

export function onStateChange(fn) {
    listeners.push(fn);
}

export function isPlaying() {
    return currentState === GameState.PLAYING;
}

export function isPaused() {
    return currentState === GameState.PAUSED;
}

export function isIntro() {
    return currentState === GameState.INTRO;
}

export function isTransitioning() {
    return currentState === GameState.TRANSITIONING;
}

export function isGameOver() {
    return currentState === GameState.GAMEOVER;
}

export function isMenu() {
    return currentState === GameState.MENU;
}
