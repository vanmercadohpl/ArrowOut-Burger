import { BGMMP3 } from "../../media/audio_BGM.mp3.js";

const BGM_VOLUME = 0.45;

let audio = null;
let unlocked = false;
let listenersBound = false;
let gestureListenersBound = false;
let pausedByEndScene = false;

const GESTURE_EVENTS = ["pointerdown", "touchstart", "click", "keydown"];

export function prepareBgm() {
  bindBgmLifecycle();
  bindGestureUnlock();
  getBgmAudio().load();
}

export function unlockAndPlayBgm() {
  pausedByEndScene = false;
  unlocked = true;
  bindBgmLifecycle();
  return playBgm();
}

export function resumeBgmIfUnlocked() {
  if (!unlocked || pausedByEndScene || document.hidden) {
    return;
  }

  playBgm();
}

export function pauseBgm() {
  pausedByEndScene = true;

  if (audio) {
    audio.pause();
  }
}

function getBgmAudio() {
  if (audio) {
    return audio;
  }

  audio = new Audio(BGMMP3);
  audio.loop = true;
  audio.volume = BGM_VOLUME;
  audio.preload = "auto";

  return audio;
}

function playBgm() {
  const bgm = getBgmAudio();

  if (!bgm.paused) {
    unbindGestureUnlock();
    return Promise.resolve(true);
  }

  return bgm
    .play()
    .then(() => {
      unbindGestureUnlock();
      return true;
    })
    .catch(() => {
      bindGestureUnlock();
      return false;
    });
}

function handleGestureUnlock() {
  if (document.hidden) {
    return;
  }

  unlockAndPlayBgm();
}

function bindGestureUnlock() {
  if (gestureListenersBound) {
    return;
  }

  gestureListenersBound = true;
  for (const eventName of GESTURE_EVENTS) {
    window.addEventListener(eventName, handleGestureUnlock, {
      capture: true,
      passive: true,
    });
  }
}

function unbindGestureUnlock() {
  if (!gestureListenersBound) {
    return;
  }

  gestureListenersBound = false;
  for (const eventName of GESTURE_EVENTS) {
    window.removeEventListener(eventName, handleGestureUnlock, {
      capture: true,
    });
  }
}

function bindBgmLifecycle() {
  if (listenersBound) {
    return;
  }

  listenersBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!audio) {
      return;
    }

    if (document.hidden) {
      audio.pause();
    } else {
      resumeBgmIfUnlocked();
    }
  });
  window.addEventListener("resize", resumeBgmIfUnlocked);
  window.addEventListener("orientationchange", resumeBgmIfUnlocked);
}
