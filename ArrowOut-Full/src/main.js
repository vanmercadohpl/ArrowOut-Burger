import Phaser from "phaser";

import { mraidAdNetworks, networkPlugin } from "./networkPlugin.js";

import { Game } from "./scenes/Game";
import { Preloader } from "./scenes/Preloader";
import { config } from "./config.js";

const viewportSize = getViewportSize();

const gameConfig = {
  type: Phaser.AUTO,
  parent: "ad-container",
  width: viewportSize.width,
  height: viewportSize.height,
  backgroundColor: "transparent",
  transparent: true,
  input: {
    mouse: true,
    touch: {
      capture: true,
    },
    activePointers: 2,
    windowEvents: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  scene: [Preloader, Game],
};

function initializePhaserGame() {
  const game = new Phaser.Game(gameConfig);

  const resizeGame = () => {
    const { width, height } = getViewportSize();
    game.scale.resize(width, height);
  };
  const scheduleResize = () => {
    requestAnimationFrame(resizeGame);
    setTimeout(resizeGame, 100);
    setTimeout(resizeGame, 300);
    setTimeout(resizeGame, 600);
  };

  window.addEventListener("resize", scheduleResize);
  window.visualViewport?.addEventListener("resize", scheduleResize);
  window.visualViewport?.addEventListener("scroll", scheduleResize);

  return game;
}

function getViewportSize() {
  const visualViewport = window.visualViewport;

  return {
    width: Math.round(visualViewport?.width || window.innerWidth),
    height: Math.round(visualViewport?.height || window.innerHeight),
  };
}

function setupGameInitialization(adNetworkType) {
  const game = initializePhaserGame();

  if (mraidAdNetworks.has(adNetworkType)) {
    networkPlugin.initMraid(() => game);
  } else {
    return game;
  }
}

setupGameInitialization(config.adNetworkType);
