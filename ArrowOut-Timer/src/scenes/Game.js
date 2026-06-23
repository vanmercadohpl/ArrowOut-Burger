import Phaser from "phaser";

import { ArrowBoxGame } from "../game/ArrowBoxGame";
import { adEnd, adStart } from "../networkPlugin";
import {
  pauseBgm,
  prepareBgm,
  resumeBgmIfUnlocked,
  unlockAndPlayBgm,
} from "../utils/bgmMusic";
import { INTRO_LIGHT_FRAME_KEYS } from "../introLightFrames";

const INTRO_LIGHT_ANIM_KEY = "introLight";
const INTRO_LIGHT_FRAME_RATE = 24;
const INTRO_LIGHT_DEPTH = 10;
const ARROW_GAME_DEPTH = INTRO_LIGHT_DEPTH + 1;
const INTRO_LIGHT_START_SCALE = 0.7;
const INTRO_LIGHT_PEAK_SCALE = 1.06;
const INTRO_LIGHT_END_SCALE = 1;
const INTRO_FADE_OUT_DURATION = 420;
const ARROW_FADE_IN_DURATION = 520;
const TRANSITION_OVERLAP_DELAY = 120;
const AUTO_FOCUS_X = 0.32;
const AUTO_FOCUS_Y = 0.1;
const AUTO_FOCUS_SCALE = 3;
const AUTO_FOCUS_DURATION = 2000;
const HEART_HUD_DEPTH = ARROW_GAME_DEPTH + 10;
const HEART_HUD_X_OFFSET_VMIN = 0;
const HEART_HUD_Y_VMIN = 12;
const HEART_HUD_WIDTH_VMIN = 13;
const HEART_HUD_GAP_VMIN = 2;
const HEART_HUD_POP_DELAY = 1000;
const HEART_HUD_POP_STAGGER = 90;
const HEART_HUD_POP_DURATION = 300;
const HEART_COLLISION_BLINK_DURATION = 120;
const HEART_COLLISION_BLINK_REPEAT = 2;
const HEART_GHOST_ALPHA = 0.24;
const HEART_GHOST_TINT = 0xb8c0cc;
const COLLISION_EDGE_FLASH_DEPTH = HEART_HUD_DEPTH + 5;
const COLLISION_EDGE_FLASH_ALPHA = 0.36;
const COLLISION_EDGE_FLASH_WIDTH_RATIO = 0.2;
const COLLISION_EDGE_FLASH_HEIGHT_RATIO = 0.11;
const COLLISION_EDGE_FLASH_DURATION = 120;
const COLLISION_EDGE_FLASH_REPEAT = 2;
const FAIL_OVERLAY_DEPTH = HEART_HUD_DEPTH + 20;
const FAIL_OVERLAY_ALPHA = 0.62;
const FAIL_SIGN_WIDTH_VMIN = 72;
const OVERLAY_OVERSCAN_VMIN = 8;
const OVERLAY_EDGE_GRADIENT_ALPHA = 0.2;
const OVERLAY_EDGE_GRADIENT_WIDTH_RATIO = 0.18;
const OVERLAY_EDGE_GRADIENT_HEIGHT_RATIO = 0.13;
const WIN_OVERLAY_DEPTH = FAIL_OVERLAY_DEPTH + 10;
const WIN_OVERLAY_ALPHA = 0.58;
const WIN_EMOJI_ANIM_KEY = "winEmoji";
const WIN_EMOJI_FRAME_RATE = 18;
const WIN_EMOJI_WIDTH_VMIN = 36;
const WIN_SIGN_WIDTH_VMIN = 50;
const WIN_STACK_GAP_VMIN = 3;
const WIN_STACK_Y_OFFSET_VMIN = -6;
const BOTTOM_HUD_DEPTH = HEART_HUD_DEPTH;
const BOTTOM_HUD_BOTTOM_VMIN = 8;
const HPL_BLACK_LEFT_VMIN = 1.8;
const INSTALL_LIGHT_RIGHT_VMIN = 1.8;
const HPL_BLACK_WIDTH_VMIN = 20;
const INSTALL_LIGHT_WIDTH_VMIN = 28;
const BOTTOM_HUD_POP_DELAY = HEART_HUD_POP_DELAY;
const BOTTOM_HUD_POP_STAGGER = 110;
const BOTTOM_HUD_POP_DURATION = 320;
const END_SCENE_DEPTH = WIN_OVERLAY_DEPTH + 10;
const END_SCENE_ALPHA = 0.9;
const END_SCENE_FAIL_DELAY = 4500;
const END_SCENE_WIN_DELAY = 2500;
const END_SCENE_HPL_WIDTH_VMIN = 65;
const END_SCENE_INSTALL_WIDTH_VMIN = 65;
const END_SCENE_STACK_GAP_VMIN = 5;
const END_SCENE_Y_OFFSET_VMIN = -2;
const END_SCENE_PULSE_SCALE = 1.055;
const END_SCENE_PULSE_DURATION = 760;
const END_SCENE_CTA_COOLDOWN = 800;
const END_SCENE_TAP_MAX_DRAG = 24;
const CTA_RESIZE_TAP_BLOCK_DURATION = 350;
const END_SCENE_POP_START_SCALE = 0.62;
const END_SCENE_POP_DURATION = 420;
const END_SCENE_POP_STAGGER = 90;
const END_SCENE_DIM_FADE_DURATION = 220;
const END_SCENE_BODY_BACKGROUND = "#000000";
const HAND_TAP_IDLE_DELAY = 5000;
const HIDDEN_END_SCENE_TIMER_DURATION = 60000;
export class Game extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  init() {
    console.log("%cSCENE::Game", "color: #fff; background: #f0efe8;");
  }

  create() {
    adStart();
    this.arrowGameShown = false;
    this.heartHudShown = false;
    this.remainingHearts = 3;
    this.failPending = false;
    this.failOverlayShown = false;
    this.winOverlayShown = false;
    this.endSceneShown = false;
    this.endSceneCtaPressed = false;
    this.endSceneInputBlockedUntil = 0;
    this.endScenePointerDown = null;
    this.bottomCtaPointerDown = null;
    this.bottomCtaInputBlockedUntil = 0;
    this.gameEndedNotified = false;
    this.hiddenEndSceneTimerStarted = false;
    this.hiddenEndSceneTimer = null;
    this.bottomHudShown = false;
    this.handTapDismissed = false;
    this.createArrowGame();
    this.createHeartHud();
    this.createCollisionEdgeFlash();
    this.createOverlayBodyEdgeGradient();
    this.createFailOverlay();
    this.createWinOverlay();
    this.createEndSceneOverlay();
    this.createBottomHud();
    this.createIntroLightAnimation();
    prepareBgm();
    this.scale.on("resize", this.relayoutIntroLight, this);
    this.scale.on("resize", this.relayoutArrowGame, this);
    this.scale.on("resize", this.relayoutHeartHud, this);
    this.scale.on("resize", this.relayoutCollisionEdgeFlash, this);
    this.scale.on("resize", this.relayoutOverlayBodyEdgeGradient, this);
    this.scale.on("resize", this.relayoutFailOverlay, this);
    this.scale.on("resize", this.relayoutWinOverlay, this);
    this.scale.on("resize", this.relayoutEndSceneOverlay, this);
    this.scale.on("resize", this.relayoutBottomHud, this);
    this.scale.on("resize", this.handleBgmResize, this);
    this.input.on("pointerdown", this.startBgm, this);
    this.input.on("pointerdown", this.handlePointerActivity, this);

    this.inputEnabled = false;
    this.handleBgmResize();
  }

  shutdown() {
    this.scale.off("resize", this.relayoutIntroLight, this);
    this.scale.off("resize", this.relayoutArrowGame, this);
    this.scale.off("resize", this.relayoutHeartHud, this);
    this.scale.off("resize", this.relayoutCollisionEdgeFlash, this);
    this.scale.off("resize", this.relayoutOverlayBodyEdgeGradient, this);
    this.scale.off("resize", this.relayoutFailOverlay, this);
    this.scale.off("resize", this.relayoutWinOverlay, this);
    this.scale.off("resize", this.relayoutEndSceneOverlay, this);
    this.scale.off("resize", this.relayoutBottomHud, this);
    this.scale.off("resize", this.handleBgmResize, this);
    this.input.off("pointerdown", this.startBgm, this);
    this.input.off("pointerdown", this.handlePointerActivity, this);
    this.introLightPulseTween?.stop();
    this.introFadeTween?.stop();
    this.arrowFadeTween?.stop();
    this.arrowFadeDelay?.remove();
    this.handTapIdleDelay?.remove();
    this.hiddenEndSceneTimer?.remove();
    this.heartHudTweens?.forEach((tween) => tween.stop());
    this.heartCollisionTween?.stop();
    this.collisionEdgeFlashTween?.stop();
    this.failOverlayDelay?.remove();
    this.endSceneDelay?.remove();
    this.endScenePopTweens?.forEach((tween) => tween.stop());
    this.endScenePulseTween?.stop();
    this.bottomHudTweens?.forEach((tween) => tween.stop());
    this.arrowGame?.destroy();
    this.heartHud?.destroy(true);
    this.collisionEdgeFlash?.destroy();
    this.overlayBodyEdgeGradient?.destroy();
    this.failOverlay?.destroy(true);
    this.winOverlay?.destroy(true);
    this.endSceneOverlay?.destroy(true);
    this.bottomHud?.destroy(true);
    this.restoreBodyBackground();
  }

  async startBgm() {
    const started = await unlockAndPlayBgm();

    if (started) {
      this.input.off("pointerdown", this.startBgm, this);
    }
  }

  handlePointerActivity() {
    this.arrowGame?.hideHandTap();
    this.handTapDismissed = true;
    this.scheduleHandTapIdleHint();
  }

  scheduleHandTapIdleHint() {
    this.handTapIdleDelay?.remove();
    this.handTapIdleDelay = this.time.delayedCall(HAND_TAP_IDLE_DELAY, () => {
      if (
        !this.arrowGameShown ||
        this.failPending ||
        this.failOverlayShown ||
        this.winOverlayShown ||
        this.endSceneShown
      ) {
        return;
      }

      this.handTapDismissed = false;
      this.arrowGame?.showHandTap(true);
    });
  }

  handleBgmResize() {
    resumeBgmIfUnlocked();
  }

  createArrowGame() {
    const { width, height } = this.scale;
    const state = this.arrowGameState || this.arrowGame?.getState();

    this.arrowGame?.destroy();
    this.arrowGame = new ArrowBoxGame(
      this,
      {
        x: 0,
        y: 0,
        width,
        height,
      },
      state,
      {
        onCollision: () => {
          if (!this.endSceneShown) {
            this.playLastHeartCollisionBlink();
          }
        },
        onArrowLaunch: () => this.startHiddenEndSceneTimer(),
        onCompleteAll: () => this.showWinOverlay(),
        isInteractionBlocked: () =>
          this.failPending ||
          this.failOverlayShown ||
          this.winOverlayShown ||
          this.endSceneShown,
      },
    ).setDepth(ARROW_GAME_DEPTH);
    const shouldShowArrowGame = this.arrowGameShown && !this.endSceneShown;

    this.arrowGame
      .setVisible(shouldShowArrowGame)
      .setAlpha(shouldShowArrowGame ? 1 : 0)
      .setInteractive(shouldShowArrowGame);
    if (shouldShowArrowGame && !this.handTapDismissed) {
      this.arrowGame.showHandTap();
    }
    this.arrowGameState = null;
  }

  relayoutArrowGame() {
    if (this.endSceneShown) {
      this.arrowGame?.setVisible(false).setInteractive(false);
      return;
    }

    this.arrowGameState = this.arrowGame?.getState();
    this.createArrowGame();
    this.arrowGame?.resetInputState();
  }

  createHeartHud() {
    if (!this.textures.exists("heartV2")) {
      console.warn("[HeartHud] heartV2 texture missing.");
      return;
    }

    this.heartHud?.destroy(true);
    this.hearts = [];
    this.heartHud = this.add.container(0, 0).setDepth(HEART_HUD_DEPTH);

    for (let index = 0; index < 3; index += 1) {
      const heart = this.add.image(0, 0, "heartV2").setOrigin(0.5);

      this.heartHud.add(heart);
      this.hearts.push(heart);
    }

    this.relayoutHeartHud();
    for (let index = 0; index < this.hearts.length; index += 1) {
      const hiddenFromRight = index >= this.remainingHearts;

      if (hiddenFromRight) {
        this.showHeartGhost(this.hearts[index]);
      } else {
        this.showHeartActive(this.hearts[index]);
      }
    }
    this.heartHud.setAlpha(this.heartHudShown ? 1 : 0);
    this.heartHud.setVisible(this.heartHudShown);
  }

  relayoutHeartHud() {
    if (!this.heartHud || !this.hearts) {
      return;
    }

    const { width } = this.scale;
    const unit = getVmin(this);
    const heartWidth = HEART_HUD_WIDTH_VMIN * unit;
    const heartGap = HEART_HUD_GAP_VMIN * unit;
    const heartXOffset = HEART_HUD_X_OFFSET_VMIN * unit;
    const heartY = HEART_HUD_Y_VMIN * unit;
    const texture = this.textures.get("heartV2").getSourceImage();
    const heartHeight = heartWidth * (texture.height / texture.width);
    const step = heartWidth + heartGap;
    const startX = -step;

    this.heartHud.setPosition(width / 2 + heartXOffset, heartY);

    for (let index = 0; index < this.hearts.length; index += 1) {
      const heart = this.hearts[index]
        .setPosition(startX + step * index, 0)
        .setDisplaySize(heartWidth, heartHeight);

      heart.baseScaleX = heart.scaleX;
      heart.baseScaleY = heart.scaleY;
    }
  }

  createCollisionEdgeFlash() {
    this.collisionEdgeFlash?.destroy();
    this.collisionEdgeFlash = this.add
      .graphics()
      .setDepth(COLLISION_EDGE_FLASH_DEPTH)
      .setAlpha(0)
      .setVisible(false);

    this.relayoutCollisionEdgeFlash();
  }

  relayoutCollisionEdgeFlash() {
    if (!this.collisionEdgeFlash) {
      return;
    }

    const { width, height } = this.scale;
    const edgeWidth = width * COLLISION_EDGE_FLASH_WIDTH_RATIO;
    const edgeHeight = height * COLLISION_EDGE_FLASH_HEIGHT_RATIO;

    this.collisionEdgeFlash.clear();
    this.collisionEdgeFlash.fillGradientStyle(
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      COLLISION_EDGE_FLASH_ALPHA,
      0,
      COLLISION_EDGE_FLASH_ALPHA,
      0,
    );
    this.collisionEdgeFlash.fillRect(0, 0, edgeWidth, height);
    this.collisionEdgeFlash.fillGradientStyle(
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      0,
      COLLISION_EDGE_FLASH_ALPHA,
      0,
      COLLISION_EDGE_FLASH_ALPHA,
    );
    this.collisionEdgeFlash.fillRect(width - edgeWidth, 0, edgeWidth, height);
    this.collisionEdgeFlash.fillGradientStyle(
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      COLLISION_EDGE_FLASH_ALPHA,
      COLLISION_EDGE_FLASH_ALPHA,
      0,
      0,
    );
    this.collisionEdgeFlash.fillRect(0, 0, width, edgeHeight);
    this.collisionEdgeFlash.fillGradientStyle(
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      0xff1f1f,
      0,
      0,
      COLLISION_EDGE_FLASH_ALPHA,
      COLLISION_EDGE_FLASH_ALPHA,
    );
    this.collisionEdgeFlash.fillRect(0, height - edgeHeight, width, edgeHeight);
  }

  playCollisionEdgeFlash() {
    if (
      !this.collisionEdgeFlash ||
      this.failOverlayShown ||
      this.winOverlayShown
    ) {
      return;
    }

    this.collisionEdgeFlashTween?.stop();
    this.collisionEdgeFlash.setVisible(true).setAlpha(1);
    this.collisionEdgeFlashTween = this.tweens.add({
      targets: this.collisionEdgeFlash,
      alpha: 0,
      duration: COLLISION_EDGE_FLASH_DURATION,
      yoyo: true,
      repeat: COLLISION_EDGE_FLASH_REPEAT,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.collisionEdgeFlash?.setVisible(false).setAlpha(0);
      },
    });
  }

  createOverlayBodyEdgeGradient() {
    this.overlayBodyEdgeGradient?.destroy();
    this.overlayBodyEdgeGradient = this.add
      .graphics()
      .setDepth(FAIL_OVERLAY_DEPTH - 1)
      .setVisible(false);

    this.relayoutOverlayBodyEdgeGradient();
  }

  relayoutOverlayBodyEdgeGradient() {
    if (!this.overlayBodyEdgeGradient) {
      return;
    }

    const overscan = getOverlayOverscan(this);

    drawOverlayEdgeGradient(
      this.overlayBodyEdgeGradient,
      this.scale.width,
      this.scale.height,
      overscan,
    );
  }

  setOverlayBodyEdgeGradientVisible(visible) {
    this.overlayBodyEdgeGradient?.setVisible(visible);
  }

  createFailOverlay() {
    if (!this.textures.exists("failSign")) {
      console.warn("[FailOverlay] failSign texture missing.");
      return;
    }

    this.failOverlay?.destroy(true);
    this.failOverlayDim = this.add
      .rectangle(0, 0, 1, 1, 0x000000, FAIL_OVERLAY_ALPHA)
      .setOrigin(0, 0);
    this.failSignImage = this.add.image(0, 0, "failSign").setOrigin(0.5);
    this.failOverlay = this.add
      .container(0, 0, [this.failOverlayDim, this.failSignImage])
      .setDepth(FAIL_OVERLAY_DEPTH)
      .setVisible(this.failOverlayShown)
      .setAlpha(this.failOverlayShown ? 1 : 0);

    this.relayoutFailOverlay();
  }

  relayoutFailOverlay() {
    if (!this.failOverlay || !this.failOverlayDim || !this.failSignImage) {
      return;
    }

    const { width, height } = this.scale;
    const unit = getVmin(this);
    const signWidth = FAIL_SIGN_WIDTH_VMIN * unit;
    const texture = this.textures.get("failSign").getSourceImage();
    const signHeight = signWidth * (texture.height / texture.width);

    setFullScreenOverlayRect(this, this.failOverlayDim);
    this.failSignImage
      .setPosition(width / 2, height / 2)
      .setDisplaySize(signWidth, signHeight);
  }

  showFailOverlay() {
    if (this.failOverlayShown || this.endSceneShown) {
      return;
    }

    this.clearHiddenEndSceneTimer();
    this.failPending = false;
    this.failOverlayShown = true;
    this.applyEndSceneBodyBackground();
    this.notifyGameEndedOnce();
    this.heartCollisionTween?.stop();
    this.failOverlayDelay?.remove();
    this.failOverlayDelay = null;
    this.heartCollisionTarget?.setVisible(false).setAlpha(0);
    this.heartCollisionTarget = null;
    this.arrowGame?.setInteractive(false);
    this.setOverlayBodyEdgeGradientVisible(true);
    this.failOverlay?.setVisible(true).setAlpha(1);

    if (this.cache.audio.exists("fail")) {
      this.sound.play("fail");
    }

    this.scheduleEndSceneOverlay(END_SCENE_FAIL_DELAY);
  }

  createWinOverlay() {
    if (
      !this.textures.exists("winSign") ||
      !this.textures.exists("emojiWin1")
    ) {
      console.warn("[WinOverlay] winSign or emoji frames missing.");
      return;
    }

    this.winOverlay?.destroy(true);
    this.winOverlayDim = this.add
      .rectangle(0, 0, 1, 1, 0x000000, WIN_OVERLAY_ALPHA)
      .setOrigin(0, 0);
    this.winEmojiSprite = this.add.sprite(0, 0, "emojiWin1").setOrigin(0.5);
    this.winSignImage = this.add.image(0, 0, "winSign").setOrigin(0.5);
    this.winOverlay = this.add
      .container(0, 0, [
        this.winOverlayDim,
        this.winEmojiSprite,
        this.winSignImage,
      ])
      .setDepth(WIN_OVERLAY_DEPTH)
      .setVisible(false)
      .setAlpha(0);

    this.createWinEmojiAnimation();
    this.relayoutWinOverlay();
  }

  createWinEmojiAnimation() {
    const frameKeys = [];

    for (let index = 1; index <= 24; index += 1) {
      const key = `emojiWin${index}`;

      if (this.textures.exists(key)) {
        frameKeys.push(key);
      }
    }

    if (!this.anims.exists(WIN_EMOJI_ANIM_KEY) && frameKeys.length > 0) {
      this.anims.create({
        key: WIN_EMOJI_ANIM_KEY,
        frames: frameKeys.map((key) => ({ key })),
        frameRate: WIN_EMOJI_FRAME_RATE,
        repeat: -1,
      });
    }
  }

  relayoutWinOverlay() {
    if (
      !this.winOverlay ||
      !this.winOverlayDim ||
      !this.winEmojiSprite ||
      !this.winSignImage
    ) {
      return;
    }

    const { width, height } = this.scale;
    const unit = getVmin(this);
    const emojiWidth = WIN_EMOJI_WIDTH_VMIN * unit;
    const signWidth = WIN_SIGN_WIDTH_VMIN * unit;
    const gap = WIN_STACK_GAP_VMIN * unit;
    const emojiTexture = this.textures.get("emojiWin1").getSourceImage();
    const signTexture = this.textures.get("winSign").getSourceImage();
    const emojiHeight = emojiWidth * (emojiTexture.height / emojiTexture.width);
    const signHeight = signWidth * (signTexture.height / signTexture.width);
    const stackHeight = emojiHeight + gap + signHeight;
    const startY =
      height / 2 - stackHeight / 2 + WIN_STACK_Y_OFFSET_VMIN * unit;

    setFullScreenOverlayRect(this, this.winOverlayDim);
    this.winEmojiSprite
      .setPosition(width / 2, startY + emojiHeight / 2)
      .setDisplaySize(emojiWidth, emojiHeight);
    this.winSignImage
      .setPosition(width / 2, startY + emojiHeight + gap + signHeight / 2)
      .setDisplaySize(signWidth, signHeight);
  }

  showWinOverlay() {
    if (this.winOverlayShown || this.failOverlayShown || this.endSceneShown) {
      return;
    }

    this.clearHiddenEndSceneTimer();
    this.winOverlayShown = true;
    this.failPending = false;
    this.applyEndSceneBodyBackground();
    this.notifyGameEndedOnce();
    this.arrowGame?.setInteractive(false);
    this.setOverlayBodyEdgeGradientVisible(true);
    this.winOverlay?.setVisible(true).setAlpha(1);
    this.winEmojiSprite?.play(WIN_EMOJI_ANIM_KEY);

    if (this.cache.audio.exists("emojiLaugh")) {
      this.sound.play("emojiLaugh");
    }

    this.scheduleEndSceneOverlay(END_SCENE_WIN_DELAY);
  }

  createEndSceneOverlay() {
    if (
      !this.textures.exists("hplWhite") ||
      !this.textures.exists("installLight")
    ) {
      console.warn("[EndScene] hplWhite or installLight texture missing.");
      return;
    }

    this.endSceneOverlay?.destroy(true);
    this.endSceneDim = this.add
      .rectangle(0, 0, 1, 1, 0x000000, END_SCENE_ALPHA)
      .setOrigin(0, 0);
    this.endSceneHplImage = this.add.image(0, 0, "hplWhite").setOrigin(0.5);
    this.endSceneInstallImage = this.add
      .image(0, 0, "installLight")
      .setOrigin(0.5);
    this.endSceneOverlay = this.add
      .container(0, 0, [
        this.endSceneDim,
        this.endSceneHplImage,
        this.endSceneInstallImage,
      ])
      .setDepth(END_SCENE_DEPTH)
      .setVisible(this.endSceneShown)
      .setAlpha(this.endSceneShown ? 1 : 0);

    this.endSceneDim.on("pointerdown", this.handleEndScenePointerDown, this);
    this.endSceneDim.on("pointerup", this.handleEndSceneCtaPressed, this);
    this.relayoutEndSceneOverlay();
  }

  relayoutEndSceneOverlay() {
    if (
      !this.endSceneOverlay ||
      !this.endSceneDim ||
      !this.endSceneHplImage ||
      !this.endSceneInstallImage
    ) {
      return;
    }

    const { width, height } = this.scale;
    const unit = getVmin(this);
    const hplWidth = END_SCENE_HPL_WIDTH_VMIN * unit;
    const installWidth = END_SCENE_INSTALL_WIDTH_VMIN * unit;
    const gap = END_SCENE_STACK_GAP_VMIN * unit;
    const hplTexture = this.textures.get("hplWhite").getSourceImage();
    const installTexture = this.textures.get("installLight").getSourceImage();
    const hplHeight = hplWidth * (hplTexture.height / hplTexture.width);
    const installHeight =
      installWidth * (installTexture.height / installTexture.width);
    const stackHeight = hplHeight + gap + installHeight;
    const startY =
      height / 2 - stackHeight / 2 + END_SCENE_Y_OFFSET_VMIN * unit;

    this.endScenePointerDown = null;
    if (this.endSceneShown) {
      this.endSceneInputBlockedUntil =
        this.time.now + CTA_RESIZE_TAP_BLOCK_DURATION;
    }
    const overscan = setFullScreenOverlayRect(this, this.endSceneDim);
    if (this.endSceneShown) {
      this.endSceneDim.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(
          -overscan,
          -overscan,
          width + overscan * 3,
          height + overscan * 3,
        ),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        cursor: "pointer",
      });
      this.endSceneInstallImage.disableInteractive();
    } else {
      this.endSceneDim.disableInteractive();
      this.endSceneInstallImage.disableInteractive();
    }
    this.endSceneHplImage
      .setPosition(width / 2, startY + hplHeight / 2)
      .setDisplaySize(hplWidth, hplHeight);
    this.endSceneInstallImage
      .setPosition(width / 2, startY + hplHeight + gap + installHeight / 2)
      .setDisplaySize(installWidth, installHeight);

    this.endSceneHplImage.baseScaleX = this.endSceneHplImage.scaleX;
    this.endSceneHplImage.baseScaleY = this.endSceneHplImage.scaleY;
    this.endSceneInstallImage.baseScaleX = this.endSceneInstallImage.scaleX;
    this.endSceneInstallImage.baseScaleY = this.endSceneInstallImage.scaleY;

    if (this.endSceneShown) {
      this.startEndScenePulse();
    }
  }

  scheduleEndSceneOverlay(delay) {
    if (this.endSceneShown || this.endSceneDelay) {
      return;
    }

    this.endSceneDelay = this.time.delayedCall(delay, () => {
      this.endSceneDelay = null;
      this.showEndSceneOverlay();
    });
  }

  showEndSceneOverlay() {
    if (this.endSceneShown) {
      return;
    }

    this.clearHiddenEndSceneTimer();
    this.endSceneShown = true;
    this.applyEndSceneBodyBackground();
    this.hideGameplayForEndScene();
    this.setOverlayBodyEdgeGradientVisible(false);
    this.endSceneOverlay?.setVisible(true).setAlpha(1);
    this.endSceneDim?.setAlpha(0);
    this.relayoutEndSceneOverlay();
    pauseBgm();
    this.tweens.add({
      targets: this.endSceneDim,
      alpha: 1,
      duration: END_SCENE_DIM_FADE_DURATION,
      ease: "Sine.easeOut",
    });
    this.playEndScenePop();

    if (this.cache.audio.exists("winSound")) {
      this.sound.play("winSound");
    }
  }

  handleEndScenePointerDown(pointer) {
    if (
      !this.endSceneShown ||
      !pointer ||
      this.time.now < this.endSceneInputBlockedUntil ||
      !this.isPointerFromGameCanvas(pointer)
    ) {
      this.endScenePointerDown = null;
      return;
    }

    this.endScenePointerDown = {
      id: pointer.id,
      x: pointer.x,
      y: pointer.y,
    };
  }

  handleEndSceneCtaPressed(pointer) {
    if (
      !this.endSceneShown ||
      this.endSceneCtaPressed ||
      this.time.now < this.endSceneInputBlockedUntil ||
      !this.isPointerFromGameCanvas(pointer)
    ) {
      this.endScenePointerDown = null;
      return;
    }

    if (!this.isValidEndSceneTap(pointer)) {
      return;
    }

    this.endScenePointerDown = null;
    this.endSceneCtaPressed = true;
    handleRedirect();
    this.time.delayedCall(END_SCENE_CTA_COOLDOWN, () => {
      this.endSceneCtaPressed = false;
    });
  }

  isValidEndSceneTap(pointer) {
    const down = this.endScenePointerDown;

    if (!down || !pointer || pointer.id !== down.id) {
      this.endScenePointerDown = null;
      return false;
    }

    const dx = pointer.x - down.x;
    const dy = pointer.y - down.y;
    const maxDrag = END_SCENE_TAP_MAX_DRAG;

    if (dx * dx + dy * dy > maxDrag * maxDrag) {
      this.endScenePointerDown = null;
      return false;
    }

    return true;
  }

  notifyGameEndedOnce() {
    if (this.gameEndedNotified) {
      return;
    }

    this.gameEndedNotified = true;
    adEnd();
  }

  startHiddenEndSceneTimer() {
    if (
      this.hiddenEndSceneTimerStarted ||
      this.failOverlayShown ||
      this.winOverlayShown ||
      this.endSceneShown
    ) {
      return;
    }

    this.hiddenEndSceneTimerStarted = true;
    this.hiddenEndSceneTimer = this.time.delayedCall(
      HIDDEN_END_SCENE_TIMER_DURATION,
      () => {
        this.hiddenEndSceneTimer = null;
        if (
          this.failOverlayShown ||
          this.winOverlayShown ||
          this.endSceneShown
        ) {
          return;
        }

        this.notifyGameEndedOnce();
        this.showEndSceneOverlay();
      },
    );
  }

  clearHiddenEndSceneTimer() {
    this.hiddenEndSceneTimer?.remove();
    this.hiddenEndSceneTimer = null;
  }

  applyEndSceneBodyBackground() {
    if (this.previousBodyBackground === undefined) {
      this.previousBodyBackground = document.body.style.backgroundColor;
    }

    document.body.style.backgroundColor = END_SCENE_BODY_BACKGROUND;
  }

  restoreBodyBackground() {
    if (this.previousBodyBackground === undefined) {
      return;
    }

    document.body.style.backgroundColor = this.previousBodyBackground || "";
    this.previousBodyBackground = undefined;
  }

  hideGameplayForEndScene() {
    this.arrowGameShown = false;
    this.heartHudShown = false;
    this.failOverlayShown = false;
    this.winOverlayShown = false;
    this.bottomHudShown = false;

    this.introLightPulseTween?.stop();
    this.introFadeTween?.stop();
    this.arrowFadeTween?.stop();
    this.arrowFadeDelay?.remove();
    this.heartHudTweens?.forEach((tween) => tween.stop());
    this.heartCollisionTween?.stop();
    this.failOverlayDelay?.remove();
    this.bottomHudTweens?.forEach((tween) => tween.stop());

    this.introLight?.setVisible(false);
    this.arrowGame?.setVisible(false).setInteractive(false);
    this.heartHud?.setVisible(false);
    this.failOverlay?.setVisible(false);
    this.winOverlay?.setVisible(false);
    this.bottomHud?.setVisible(false);
    this.setOverlayBodyEdgeGradientVisible(false);
    this.winEmojiSprite?.stop();
  }

  playEndScenePop() {
    if (!this.endSceneHplImage || !this.endSceneInstallImage) {
      return;
    }

    this.endScenePulseTween?.stop();
    this.endScenePopTweens?.forEach((tween) => tween.stop());
    this.endScenePopTweens = [];

    const items = [this.endSceneHplImage, this.endSceneInstallImage];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      item
        .setAlpha(0)
        .setScale(
          item.baseScaleX * END_SCENE_POP_START_SCALE,
          item.baseScaleY * END_SCENE_POP_START_SCALE,
        );

      this.endScenePopTweens.push(
        this.tweens.add({
          targets: item,
          alpha: 1,
          scaleX: item.baseScaleX,
          scaleY: item.baseScaleY,
          delay: END_SCENE_POP_STAGGER * index,
          duration: END_SCENE_POP_DURATION,
          ease: "Back.Out",
          onComplete: () => {
            if (item === this.endSceneInstallImage) {
              this.startEndScenePulse();
            }
          },
        }),
      );
    }
  }

  startEndScenePulse() {
    if (!this.endSceneInstallImage) {
      return;
    }

    this.endScenePulseTween?.stop();
    this.endSceneInstallImage.setScale(
      this.endSceneInstallImage.baseScaleX,
      this.endSceneInstallImage.baseScaleY,
    );
    this.endScenePulseTween = this.tweens.add({
      targets: this.endSceneInstallImage,
      scaleX: this.endSceneInstallImage.baseScaleX * END_SCENE_PULSE_SCALE,
      scaleY: this.endSceneInstallImage.baseScaleY * END_SCENE_PULSE_SCALE,
      duration: END_SCENE_PULSE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  createBottomHud() {
    if (
      !this.textures.exists("hplBlack") ||
      !this.textures.exists("installLight")
    ) {
      console.warn("[BottomHud] hplBlack or installLight texture missing.");
      return;
    }

    this.bottomHud?.destroy(true);
    this.bottomHudItems = [];
    this.bottomHud = this.add.container(0, 0).setDepth(BOTTOM_HUD_DEPTH);
    this.hplBlackImage = this.add.image(0, 0, "hplBlack").setOrigin(0.5);
    this.installLightImage = this.add
      .image(0, 0, "installLight")
      .setOrigin(0.5)
      .setInteractive({ cursor: "pointer" });
    this.installLightImage.on(
      "pointerdown",
      this.handleBottomCtaPointerDown,
      this,
    );
    this.installLightImage.on("pointerup", this.handleBottomCtaPressed, this);

    this.bottomHud.add([this.hplBlackImage, this.installLightImage]);
    this.bottomHudItems.push(this.hplBlackImage, this.installLightImage);
    this.relayoutBottomHud();
    this.bottomHud.setAlpha(this.bottomHudShown ? 1 : 0);
    this.bottomHud.setVisible(this.bottomHudShown);
  }

  relayoutBottomHud() {
    if (!this.bottomHud || !this.hplBlackImage || !this.installLightImage) {
      return;
    }

    const { width, height } = this.scale;
    const unit = getVmin(this);
    const bottomOffset = BOTTOM_HUD_BOTTOM_VMIN * unit;
    const hplLeft = HPL_BLACK_LEFT_VMIN * unit;
    const installRight = INSTALL_LIGHT_RIGHT_VMIN * unit;
    const hplWidth = HPL_BLACK_WIDTH_VMIN * unit;
    const installWidth = INSTALL_LIGHT_WIDTH_VMIN * unit;
    const hplTexture = this.textures.get("hplBlack").getSourceImage();
    const installTexture = this.textures.get("installLight").getSourceImage();
    const hplHeight = hplWidth * (hplTexture.height / hplTexture.width);
    const installHeight =
      installWidth * (installTexture.height / installTexture.width);
    this.bottomCtaPointerDown = null;
    if (this.bottomHudShown && !this.endSceneShown) {
      this.bottomCtaInputBlockedUntil =
        this.time.now + CTA_RESIZE_TAP_BLOCK_DURATION;
    }
    this.bottomHud.setPosition(0, height - bottomOffset);

    this.hplBlackImage
      .setPosition(hplLeft + hplWidth / 2, 0)
      .setDisplaySize(hplWidth, hplHeight);
    this.installLightImage
      .setPosition(width - installRight - installWidth / 2, 0)
      .setDisplaySize(installWidth, installHeight);

    for (const item of this.bottomHudItems) {
      item.baseScaleX = item.scaleX;
      item.baseScaleY = item.scaleY;
    }
  }

  createIntroLightAnimation() {
    const frameKeys = INTRO_LIGHT_FRAME_KEYS.filter((key) =>
      this.textures.exists(key),
    );

    if (frameKeys.length === 0) {
      console.warn("[IntroLight] No loaded frames found.");
      this.showArrowGame();
      return;
    }

    this.introLightFrameCount = frameKeys.length;

    if (!this.anims.exists(INTRO_LIGHT_ANIM_KEY)) {
      this.anims.create({
        key: INTRO_LIGHT_ANIM_KEY,
        frames: frameKeys.map((key) => ({ key })),
        frameRate: INTRO_LIGHT_FRAME_RATE,
        repeat: 0,
      });
    }

    this.introLight = this.add
      .sprite(0, 0, frameKeys[0])
      .setOrigin(0.5)
      .setDepth(INTRO_LIGHT_DEPTH);

    this.relayoutIntroLight();
    this.startIntroLightPulse();

    this.introLight.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.startIntroToGameTransition,
      this,
    );
    this.introLight.play(INTRO_LIGHT_ANIM_KEY);
  }

  relayoutIntroLight() {
    if (!this.introLight) {
      return;
    }

    const { width, height } = this.scale;

    this.introLight.setPosition(width / 2, height / 2);
    this.introLightBaseScale = objectContain(this.introLight, width, height);

    if (this.introLightPulseTween) {
      this.startIntroLightPulse();
    }
  }

  startIntroLightPulse() {
    if (
      !this.introLight ||
      !this.introLightBaseScale ||
      !this.introLightFrameCount
    ) {
      return;
    }

    this.introLightPulseTween?.stop();
    const duration =
      (this.introLightFrameCount / INTRO_LIGHT_FRAME_RATE) * 1000;
    const growDuration = duration * 0.72;
    const settleDuration = duration - growDuration;

    this.introLight.setScale(
      this.introLightBaseScale * INTRO_LIGHT_START_SCALE,
    );

    this.introLightPulseTween = this.tweens.add({
      targets: this.introLight,
      scale: this.introLightBaseScale * INTRO_LIGHT_PEAK_SCALE,
      duration: growDuration,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.introLightPulseTween = this.tweens.add({
          targets: this.introLight,
          scale: this.introLightBaseScale * INTRO_LIGHT_END_SCALE,
          duration: settleDuration,
          ease: "Sine.easeInOut",
        });
      },
    });
  }

  startIntroToGameTransition() {
    if (this.arrowGameShown) {
      return;
    }

    this.introLightPulseTween?.stop();
    this.introFadeTween = this.tweens.add({
      targets: this.introLight,
      alpha: 0,
      duration: INTRO_FADE_OUT_DURATION,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.introLight?.setVisible(false);
      },
    });

    this.arrowFadeDelay = this.time.delayedCall(TRANSITION_OVERLAP_DELAY, () =>
      this.showArrowGame(),
    );
  }

  showArrowGame() {
    if (!this.arrowGame || this.arrowGameShown) {
      return;
    }

    this.arrowGameShown = true;
    this.arrowGame.setAlpha(0).setVisible(true).setInteractive(false);
    this.playHeartHudPop();
    this.playBottomHudPop();
    this.arrowFadeTween = this.tweens.add({
      targets: [this.arrowGame.group, this.arrowGame.dragBorder],
      alpha: 1,
      duration: ARROW_FADE_IN_DURATION,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.arrowGame?.focusBoardPoint(
          AUTO_FOCUS_X,
          AUTO_FOCUS_Y,
          AUTO_FOCUS_SCALE,
          AUTO_FOCUS_DURATION,
          () => {
            this.arrowGame?.showHandTap();
            this.arrowGame?.setInteractive(true);
          },
        );
      },
    });
  }

  playHeartHudPop() {
    if (!this.heartHud || !this.hearts || this.heartHudShown) {
      return;
    }

    this.heartHudShown = true;
    this.heartHud.setVisible(true).setAlpha(1);
    this.heartHudTweens = [];

    for (let index = 0; index < this.hearts.length; index += 1) {
      const heart = this.hearts[index];

      if (index >= this.remainingHearts) {
        this.showHeartGhost(heart);
        continue;
      }

      heart.clearTint();
      heart
        .setVisible(true)
        .setAlpha(0)
        .setScale(heart.baseScaleX * 0.55, heart.baseScaleY * 0.55);
      this.heartHudTweens.push(
        this.tweens.add({
          targets: heart,
          alpha: 1,
          scaleX: heart.baseScaleX,
          scaleY: heart.baseScaleY,
          delay: HEART_HUD_POP_DELAY + HEART_HUD_POP_STAGGER * index,
          duration: HEART_HUD_POP_DURATION,
          ease: "Back.Out",
        }),
      );
    }
  }

  playLastHeartCollisionBlink() {
    if (!this.hearts?.length || this.failPending || this.failOverlayShown) {
      return;
    }

    this.playCollisionEdgeFlash();

    if (this.remainingHearts <= 0) {
      this.showFailOverlay();
      return;
    }

    if (this.heartCollisionTween?.isPlaying()) {
      this.heartCollisionTween.stop();
      this.heartCollisionTarget?.setVisible(false).setAlpha(0);
      this.heartCollisionTarget = null;
    }

    const heartIndex = this.remainingHearts - 1;
    const heart = this.hearts[heartIndex];
    const shouldShowFail = this.remainingHearts === 1;

    this.remainingHearts = Math.max(this.remainingHearts - 1, 0);

    if (shouldShowFail) {
      this.failPending = true;
      this.arrowGame?.setInteractive(false);
      this.failOverlayDelay?.remove();
      this.failOverlayDelay = this.time.delayedCall(
        getHeartBlinkDuration(),
        () => this.showFailOverlay(),
      );
    }

    if (!heart) {
      if (this.remainingHearts <= 0) {
        this.showFailOverlay();
      }
      return;
    }

    this.tweens.killTweensOf(heart);
    heart
      .setVisible(true)
      .setAlpha(1)
      .clearTint()
      .setScale(heart.baseScaleX, heart.baseScaleY);
    this.heartCollisionTarget = heart;
    this.heartCollisionTween = this.tweens.add({
      targets: heart,
      alpha: 0.15,
      duration: HEART_COLLISION_BLINK_DURATION,
      yoyo: true,
      repeat: HEART_COLLISION_BLINK_REPEAT,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.showHeartGhost(heart);
        this.heartCollisionTarget = null;
        if (shouldShowFail) {
          this.showFailOverlay();
        }
      },
    });
  }

  playBottomHudPop() {
    if (!this.bottomHud || !this.bottomHudItems || this.bottomHudShown) {
      return;
    }

    this.bottomHudShown = true;
    this.bottomHud.setVisible(true).setAlpha(1);
    this.bottomHudTweens = [];

    for (let index = 0; index < this.bottomHudItems.length; index += 1) {
      const item = this.bottomHudItems[index];

      item.setAlpha(0).setScale(item.baseScaleX * 0.55, item.baseScaleY * 0.55);
      this.bottomHudTweens.push(
        this.tweens.add({
          targets: item,
          alpha: 1,
          scaleX: item.baseScaleX,
          scaleY: item.baseScaleY,
          delay: BOTTOM_HUD_POP_DELAY + BOTTOM_HUD_POP_STAGGER * index,
          duration: BOTTOM_HUD_POP_DURATION,
          ease: "Back.Out",
        }),
      );
    }
  }

  handleBottomCtaPointerDown(pointer) {
    if (
      this.endSceneShown ||
      !pointer ||
      this.time.now < this.bottomCtaInputBlockedUntil ||
      !this.isPointerFromGameCanvas(pointer)
    ) {
      this.bottomCtaPointerDown = null;
      return;
    }

    this.bottomCtaPointerDown = {
      id: pointer.id,
      x: pointer.x,
      y: pointer.y,
    };
  }

  handleBottomCtaPressed(pointer) {
    if (
      this.endSceneShown ||
      this.time.now < this.bottomCtaInputBlockedUntil ||
      !this.isValidBottomCtaTap(pointer)
    ) {
      return;
    }

    this.bottomCtaPointerDown = null;
    this.notifyGameEndedOnce();
    handleRedirect();
  }

  isValidBottomCtaTap(pointer) {
    const down = this.bottomCtaPointerDown;

    if (
      !down ||
      !pointer ||
      pointer.id !== down.id ||
      !this.isPointerFromGameCanvas(pointer)
    ) {
      this.bottomCtaPointerDown = null;
      return false;
    }

    const dx = pointer.x - down.x;
    const dy = pointer.y - down.y;
    const maxDrag = END_SCENE_TAP_MAX_DRAG;

    if (dx * dx + dy * dy > maxDrag * maxDrag) {
      this.bottomCtaPointerDown = null;
      return false;
    }

    return true;
  }

  isPointerFromGameCanvas(pointer) {
    const event = pointer?.event;
    const target = event?.target;
    const canvas = this.game?.canvas;

    if (event && event.isTrusted === false) {
      return false;
    }

    return !target || !canvas || target === canvas;
  }

  showHeartActive(heart) {
    heart.clearTint();
    heart
      .setVisible(true)
      .setAlpha(1)
      .setScale(heart.baseScaleX, heart.baseScaleY);
  }

  showHeartGhost(heart) {
    heart
      .setVisible(true)
      .setAlpha(HEART_GHOST_ALPHA)
      .setTint(HEART_GHOST_TINT)
      .setScale(heart.baseScaleX, heart.baseScaleY);
  }
}

function objectContain(gameObject, containerWidth, containerHeight) {
  const scale = Math.min(
    containerWidth / gameObject.width,
    containerHeight / gameObject.height,
  );

  gameObject.setScale(scale);

  return scale;
}

function getVmin(scene) {
  return Math.min(scene.scale.width, scene.scale.height) / 100;
}

function getOverlayOverscan(scene) {
  return OVERLAY_OVERSCAN_VMIN * getVmin(scene);
}

function setFullScreenOverlayRect(scene, rectangle) {
  const overscan = getOverlayOverscan(scene);
  const width = scene.scale.width + overscan * 2;
  const height = scene.scale.height + overscan * 2;

  rectangle.setPosition(-overscan, -overscan).setSize(width, height);

  return overscan;
}

function drawOverlayEdgeGradient(graphics, width, height, overscan = 0) {
  const drawX = -overscan;
  const drawY = -overscan;
  const drawWidth = width + overscan * 2;
  const drawHeight = height + overscan * 2;
  const edgeWidth = drawWidth * OVERLAY_EDGE_GRADIENT_WIDTH_RATIO;
  const edgeHeight = drawHeight * OVERLAY_EDGE_GRADIENT_HEIGHT_RATIO;

  graphics.clear();
  graphics.fillGradientStyle(
    0x000000,
    0x000000,
    0x000000,
    0x000000,
    OVERLAY_EDGE_GRADIENT_ALPHA,
    0,
    OVERLAY_EDGE_GRADIENT_ALPHA,
    0,
  );
  graphics.fillRect(drawX, drawY, edgeWidth, drawHeight);
  graphics.fillGradientStyle(
    0x000000,
    0x000000,
    0x000000,
    0x000000,
    0,
    OVERLAY_EDGE_GRADIENT_ALPHA,
    0,
    OVERLAY_EDGE_GRADIENT_ALPHA,
  );
  graphics.fillRect(
    drawX + drawWidth - edgeWidth,
    drawY,
    edgeWidth,
    drawHeight,
  );
  graphics.fillGradientStyle(
    0x000000,
    0x000000,
    0x000000,
    0x000000,
    OVERLAY_EDGE_GRADIENT_ALPHA,
    OVERLAY_EDGE_GRADIENT_ALPHA,
    0,
    0,
  );
  graphics.fillRect(drawX, drawY, drawWidth, edgeHeight);
  graphics.fillGradientStyle(
    0x000000,
    0x000000,
    0x000000,
    0x000000,
    0,
    0,
    OVERLAY_EDGE_GRADIENT_ALPHA,
    OVERLAY_EDGE_GRADIENT_ALPHA,
  );
  graphics.fillRect(
    drawX,
    drawY + drawHeight - edgeHeight,
    drawWidth,
    edgeHeight,
  );
}

function getHeartBlinkDuration() {
  return (
    HEART_COLLISION_BLINK_DURATION * (HEART_COLLISION_BLINK_REPEAT + 1) * 2 + 40
  );
}

function handleRedirect() {
  if (window.mraid && typeof window.mraid.open === "function") {
    window.mraid.open("");
  } else {
    window.open("", "_blank");
  }
}
