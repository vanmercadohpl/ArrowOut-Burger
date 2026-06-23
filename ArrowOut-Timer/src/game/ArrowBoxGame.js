import Phaser from "phaser";

import { ARROW_GAME_DATA } from "./arrowGameData";

const MIN_VIEW_SCALE = 1.25;
const MAX_VIEW_SCALE = 2.7;
const TAP_MOVE_LIMIT = 10;
const DRAG_LIMITS = {
  left: 48,
  right: 48,
  top: 48,
  bottom: 48,
  maxWidth: 980,
  maxHeight: 1760,
};
const DRAG_BORDER_COLOR = 0x00d8ff;
const DRAG_BORDER_ALPHA = 0;
const DRAG_BORDER_WIDTH = 4;
const COLLIDE_SOUND_KEY = "error";
const CLICK_SOUND_KEY = "swoosh";
const SUCCESS_SOUND_KEY = "completed";
const YUMMY_SOUND_KEY = "yummy";
const FAILED_ARROW_COLOR = 0xff0000;
const COLLISION_REWIND_DURATION = 260;
const HAND_TAP_TEXTURE_KEY = "handtapV2";
const HAND_TAP_WIDTH_VMIN = 18;
const HAND_TAP_END_SCALE = 0.85;
const HAND_TAP_SCALE_DURATION = 650;
const HAND_TAP_FOCUS_SCALE = 2.7;
const HAND_TAP_FOCUS_DURATION = 900;
const DRAG_HOLD_DELAY = 80;
const DRAG_SENSITIVITY = 1.08;

export class ArrowBoxGame {
  constructor(scene, bounds, state = {}, callbacks = {}) {
    this.scene = scene;
    this.bounds = bounds;
    this.callbacks = callbacks;
    this.items = [];
    this.completedIds = new Set(state.completedIds || []);
    this.failedIds = new Set(state.failedIds || []);
    this.completed = this.completedIds.size;
    this.allCompleted = this.completed >= ARROW_GAME_DATA.arrows.length;
    this.viewScale = 1;
    this.dragPointerId = null;
    this.dragDistance = 0;
    this.lastDragX = 0;
    this.lastDragY = 0;
    this.dragHoldStartTime = 0;
    this.dragArmed = false;
    this.motionLocked = false;
    this.pinchStartDistance = 0;
    this.pinchStartScale = 1;
    this.pinchActive = false;
    this.interactiveRequested = false;
    this.handTapShown = !!state.handTapShown;
    this.dragBounds = getDragBounds(bounds, DRAG_LIMITS);

    const scale = Math.min(
      bounds.width / ARROW_GAME_DATA.canvas.width,
      bounds.height / ARROW_GAME_DATA.canvas.height,
    );
    const gameWidth = ARROW_GAME_DATA.canvas.width * scale;
    const gameHeight = ARROW_GAME_DATA.canvas.height * scale;

    this.scale = scale;
    this.offsetX = bounds.x + (bounds.width - gameWidth) / 2;
    this.offsetY = bounds.y + (bounds.height - gameHeight) / 2;
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
    this.group = scene.add.container(0, 0);

    this.dragBorder = scene.add
      .rectangle(
        this.dragBounds.x,
        this.dragBounds.y,
        this.dragBounds.width,
        this.dragBounds.height,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(DRAG_BORDER_WIDTH, DRAG_BORDER_COLOR, DRAG_BORDER_ALPHA);

    this.background = scene.add
      .rectangle(
        this.offsetX,
        this.offsetY,
        gameWidth,
        gameHeight,
        hexToNumber(
          ARROW_GAME_DATA.playBackgroundColor || ARROW_GAME_DATA.background,
        ),
        ARROW_GAME_DATA.playBackgroundTransparent ? 0 : 1,
      )
      .setOrigin(0, 0);
    this.group.add(this.background);

    for (const config of ARROW_GAME_DATA.arrows) {
      if (this.completedIds.has(config.id)) {
        continue;
      }

      this.createArrow(config);
    }

    if (state.view) {
      this.setViewState(state.view);
    } else {
      this.clampGroupPosition();
    }
    this.bindPanZoomInput();
  }

  setDepth(depth) {
    this.group.setDepth(depth);
    this.dragBorder.setDepth(depth + 1);
    return this;
  }

  setVisible(visible) {
    this.group.setVisible(visible);
    this.dragBorder.setVisible(visible);
    return this;
  }

  setAlpha(alpha) {
    this.group.setAlpha(alpha);
    this.dragBorder.setAlpha(alpha);
    return this;
  }

  setInteractive(enabled) {
    this.interactiveRequested = enabled;
    this.refreshArrowInteractivity();

    return this;
  }

  refreshArrowInteractivity() {
    const canEnable = this.canReceiveArrowInput();

    for (const item of this.items) {
      if (canEnable && !item.launched) {
        item.graphics.setInteractive({
          hitArea: item.hitArea,
          hitAreaCallback: Phaser.Geom.Polygon.Contains,
          cursor: "pointer",
        });
      } else {
        item.graphics.disableInteractive();
      }
    }
  }

  canReceiveArrowInput() {
    return (
      this.interactiveRequested &&
      this.handTapShown &&
      !this.callbacks.isInteractionBlocked?.()
    );
  }

  canUseBoardInput() {
    return this.handTapShown && !this.callbacks.isInteractionBlocked?.();
  }

  createArrow(config) {
    const graphics = this.scene.add.graphics();
    const item = {
      config,
      graphics,
      launched: false,
      stopped: false,
      failed: this.failedIds.has(config.id),
      blockedFeedback: null,
      scenePoints: [],
    };

    this.group.add(graphics);
    this.items.push(item);
    this.drawArrow(item, config.pathCommands, config.x, config.y);

    if (this.canReceiveArrowInput()) {
      graphics.setInteractive({
        hitArea: item.hitArea,
        hitAreaCallback: Phaser.Geom.Polygon.Contains,
        cursor: "pointer",
      });
    }
    graphics.on("pointerdown", (pointer) => {
      if (!this.canReceiveArrowInput()) {
        return;
      }

      item.tapPointerId = pointer.id;
      item.tapStartX = pointer.x;
      item.tapStartY = pointer.y;
    });
    graphics.on("pointerup", (pointer) => {
      if (
        this.canReceiveArrowInput() &&
        item.tapPointerId === pointer.id &&
        !this.pinchActive &&
        Math.hypot(pointer.x - item.tapStartX, pointer.y - item.tapStartY) <=
          TAP_MOVE_LIMIT &&
        this.dragDistance <= TAP_MOVE_LIMIT
      ) {
        this.launchArrow(item);
      }

      item.tapPointerId = null;
    });
  }

  drawArrow(item, commands, x, y) {
    const { graphics, config } = item;
    const points = commandsToPoints(commands);
    const worldPoints = points.map((point) =>
      this.toScenePoint(transformLocalPoint(point, x, y, config.rotation || 0)),
    );

    graphics.clear();
    graphics.fillStyle(item.failed ? FAILED_ARROW_COLOR : config.fillColor, 1);
    graphics.fillPoints(worldPoints, true);

    if (config.addOutline !== false && (config.outlineWidth || 0) > 0) {
      graphics.lineStyle(
        Math.max(1, this.scale * config.outlineWidth),
        config.outlineColor ?? 0xfff1b8,
        1,
      );
      graphics.strokePoints(worldPoints, true);
    }

    item.hitArea = new Phaser.Geom.Polygon(worldPoints);
    item.scenePoints = worldPoints;
    if (graphics.input) {
      graphics.input.hitArea = item.hitArea;
    }
  }

  launchArrow(item) {
    if (
      item.launched ||
      this.motionLocked ||
      this.callbacks.isInteractionBlocked?.()
    ) {
      return;
    }

    if (item.stopped) {
      item.stopped = false;
      this.drawArrow(
        item,
        item.config.pathCommands,
        item.config.homeX ?? item.config.x,
        item.config.homeY ?? item.config.y,
      );
    }

    const path = getSnakeLaunchPath(item.config, ARROW_GAME_DATA.canvas);
    this.motionLocked = true;
    item.launched = true;
    this.setInteractive(false);
    this.playSound(CLICK_SOUND_KEY);
    this.callbacks.onArrowLaunch?.(item.config);

    const duration = getReleaseDuration(
      path.totalDistance,
      ARROW_GAME_DATA.arrowSpeed,
    );
    const ignoredCollisionPairs = this.getInitialCollisionPairs(item);
    let previousTravelDistance = 0;
    let stoppedByCollision = false;
    let completedByExit = false;

    const tween = this.scene.tweens.addCounter({
      from: 0,
      to: path.totalDistance,
      duration,
      ease: "Cubic.easeOut",
      onUpdate: (tween) => {
        if (stoppedByCollision) {
          return;
        }

        const targetTravelDistance = tween.getValue();
        const collision = this.checkCollisionsForTravel(
          item,
          path,
          previousTravelDistance,
          targetTravelDistance,
          ignoredCollisionPairs,
        );
        const renderDistance =
          collision.collided &&
          (ARROW_GAME_DATA.stopOnCollision ||
            ARROW_GAME_DATA.resetPositionOnCollision)
            ? collision.distance
            : targetTravelDistance;
        const visiblePoints = getSnakeVisiblePoints(path, renderDistance);
        const commands = getVisibleArrowPathCommands(
          item.config,
          visiblePoints,
        );

        this.drawArrow(item, commands, 0, 0);
        previousTravelDistance = renderDistance;

        if (!collision.collided && !this.isItemVisibleOnScreen(item)) {
          completedByExit = true;
          tween.stop();
          this.completeArrow(item);
          return;
        }

        if (collision.collided && ARROW_GAME_DATA.resetPositionOnCollision) {
          stoppedByCollision = true;
          tween.stop();
          this.showBlockedFeedback(item, () => {
            this.rewindArrowToHome(item, path, collision.distance, () => {
              this.markArrowFailed(item);
              this.resetArrow(item);
            });
          });
          return;
        }

        if (collision.collided && ARROW_GAME_DATA.stopOnCollision) {
          stoppedByCollision = true;
          tween.stop();
          this.showBlockedFeedback(item, () => {
            this.rewindArrowToHome(item, path, collision.distance, () => {
              this.markArrowFailed(item);
              this.resetArrow(item);
            });
          });
        }
      },
      onComplete: () => {
        if (stoppedByCollision || completedByExit) {
          return;
        }

        this.completeArrow(item);
      },
    });
  }

  completeArrow(item) {
    if (!item.graphics.active) {
      return;
    }

    item.graphics.destroy();
    this.items = this.items.filter((candidate) => candidate !== item);
    item.scenePoints = [];
    this.completedIds.add(item.config.id);
    this.failedIds.delete(item.config.id);
    this.completed += 1;
    this.playSound(SUCCESS_SOUND_KEY);
    if (this.completed % 5 === 0) {
      this.playSound(YUMMY_SOUND_KEY);
    }
    this.callbacks.onCompleteArrow?.(item.config);
    if (!this.allCompleted && this.completed >= ARROW_GAME_DATA.arrows.length) {
      this.allCompleted = true;
      this.callbacks.onCompleteAll?.();
    }
    this.releaseMotionLock();
  }

  isItemVisibleOnScreen(item) {
    if (item.scenePoints.length < 3) {
      return false;
    }

    const bounds = getBoundsFromPoints(item.scenePoints);
    const screenBounds = {
      left: this.group.x + bounds.left * this.viewScale,
      right: this.group.x + bounds.right * this.viewScale,
      top: this.group.y + bounds.top * this.viewScale,
      bottom: this.group.y + bounds.bottom * this.viewScale,
    };

    return boundsOverlap(screenBounds, {
      left: 0,
      right: this.scene.scale.width,
      top: 0,
      bottom: this.scene.scale.height,
    });
  }

  checkCollisionsForTravel(
    item,
    path,
    fromDistance,
    toDistance,
    ignoredCollisionPairs,
  ) {
    if (!ARROW_GAME_DATA.addCollide) {
      return { collided: false, distance: toDistance };
    }

    const distance = Math.max(toDistance - fromDistance, 0);
    const stepSize = getCollisionSampleStep(item.config);
    const sampleCount = Math.max(1, Math.ceil(distance / stepSize));

    for (let index = 1; index <= sampleCount; index += 1) {
      const sampleDistance = fromDistance + (distance * index) / sampleCount;
      const visiblePoints = getSnakeVisiblePoints(path, sampleDistance);
      const commands = getVisibleArrowPathCommands(item.config, visiblePoints);
      const movingPolygon = this.commandsToScenePolygon(commands, 0, 0);
      const movingBounds = getBoundsFromPoints(movingPolygon);

      for (const blocker of this.items) {
        if (
          blocker === item ||
          !blocker.graphics.active ||
          blocker.scenePoints.length < 3
        ) {
          continue;
        }

        const pairKey = getCollisionPairKey(item.config.id, blocker.config.id);
        const blockerBounds = getBoundsFromPoints(blocker.scenePoints);

        if (!boundsOverlap(movingBounds, blockerBounds)) {
          ignoredCollisionPairs.delete(pairKey);
          continue;
        }

        if (!polygonsOverlap(movingPolygon, blocker.scenePoints)) {
          ignoredCollisionPairs.delete(pairKey);
          continue;
        }

        if (ignoredCollisionPairs.has(pairKey)) {
          continue;
        }

        this.playSound(COLLIDE_SOUND_KEY);
        this.callbacks.onCollision?.(item.config);
        return { collided: true, distance: sampleDistance };
      }
    }

    return { collided: false, distance: toDistance };
  }

  getInitialCollisionPairs(item) {
    const pairs = new Set();
    const activeBounds = getBoundsFromPoints(item.scenePoints);

    for (const blocker of this.items) {
      if (
        blocker === item ||
        !blocker.graphics.active ||
        blocker.scenePoints.length < 3
      ) {
        continue;
      }

      if (
        boundsOverlap(activeBounds, getBoundsFromPoints(blocker.scenePoints)) &&
        polygonsOverlap(item.scenePoints, blocker.scenePoints)
      ) {
        pairs.add(getCollisionPairKey(item.config.id, blocker.config.id));
      }
    }

    return pairs;
  }

  resetArrow(item) {
    item.launched = false;
    item.stopped = false;
    this.drawArrow(
      item,
      item.config.pathCommands,
      item.config.homeX ?? item.config.x,
      item.config.homeY ?? item.config.y,
    );
    if (this.canReceiveArrowInput()) {
      item.graphics.setInteractive({
        hitArea: item.hitArea,
        hitAreaCallback: Phaser.Geom.Polygon.Contains,
        cursor: "pointer",
      });
    }
    this.releaseMotionLock();
  }

  releaseMotionLock() {
    this.motionLocked = false;
    this.setInteractive(true);
  }

  rewindArrowToHome(item, path, collisionDistance, onComplete) {
    this.scene.tweens.addCounter({
      from: collisionDistance,
      to: 0,
      duration: COLLISION_REWIND_DURATION,
      ease: "Cubic.easeInOut",
      onUpdate: (tween) => {
        const visiblePoints = getSnakeVisiblePoints(path, tween.getValue());
        const commands = getVisibleArrowPathCommands(
          item.config,
          visiblePoints,
        );

        this.drawArrow(item, commands, 0, 0);
      },
      onComplete,
    });
  }

  markArrowFailed(item) {
    item.failed = true;
    this.failedIds.add(item.config.id);
  }

  showHandTap(focusTarget = false) {
    if (!this.scene.textures.exists(HAND_TAP_TEXTURE_KEY)) {
      return;
    }

    const targetItem = this.getHandTapTargetItem();
    const targetConfig = targetItem?.config;

    if (
      !targetItem ||
      !targetConfig ||
      this.completedIds.has(targetConfig.id)
    ) {
      return;
    }

    if (focusTarget) {
      this.focusHandTapTarget(targetConfig, () => {
        if (this.items.includes(targetItem) && targetItem.graphics.active) {
          this.showHandTapAtConfig(targetConfig);
        }
      });
      return;
    }

    this.showHandTapAtConfig(targetConfig);
  }

  showHandTapAtConfig(targetConfig) {
    this.handTapTween?.stop();
    this.handTap?.destroy();

    const centerline = getConfigWorldCenterlinePoints(targetConfig);
    const tip = centerline[centerline.length - 1];
    const sceneTip = this.toScenePoint(tip);

    this.handTap = this.scene.add
      .image(sceneTip.x, sceneTip.y, HAND_TAP_TEXTURE_KEY)
      .setOrigin(0, 0);
    this.group.add(this.handTap);
    this.handTapScale = 1;
    this.handTapShown = true;
    this.updateHandTapSize();
    this.playHandTapScaleDown();
    this.refreshArrowInteractivity();
  }

  focusHandTapTarget(targetConfig, onComplete) {
    const centerline = getConfigWorldCenterlinePoints(targetConfig);
    const tip = this.toScenePoint(centerline[centerline.length - 1]);
    const centerX = this.bounds.x + this.bounds.width / 2;
    const centerY = this.bounds.y + this.bounds.height / 2;
    const nextScale = Phaser.Math.Clamp(
      Math.max(this.viewScale, HAND_TAP_FOCUS_SCALE),
      MIN_VIEW_SCALE,
      MAX_VIEW_SCALE,
    );
    const targetPosition = this.getClampedGroupPosition(
      centerX - tip.x * nextScale,
      centerY - tip.y * nextScale,
      nextScale,
    );
    const view = {
      x: this.group.x,
      y: this.group.y,
      scale: this.viewScale,
    };

    this.focusTween?.stop();
    this.handTapTween?.stop();
    this.handTap?.destroy();
    this.handTap = null;
    this.focusTween = this.scene.tweens.add({
      targets: view,
      x: targetPosition.x,
      y: targetPosition.y,
      scale: nextScale,
      duration: HAND_TAP_FOCUS_DURATION,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.viewScale = view.scale;
        this.group.setScale(view.scale);
        this.group.setPosition(view.x, view.y);
        this.updateHandTapSize();
        this.clampGroupPosition();
      },
      onComplete,
    });
  }

  getHandTapTargetItem() {
    for (const item of this.items) {
      if (
        item.graphics.active &&
        !item.launched &&
        this.canArrowExitWithoutCollision(item)
      ) {
        return item;
      }
    }

    for (const item of this.items) {
      if (item.graphics.active && !item.launched) {
        return item;
      }
    }

    return null;
  }

  canArrowExitWithoutCollision(item) {
    if (!ARROW_GAME_DATA.addCollide) {
      return true;
    }

    const path = getSnakeLaunchPath(item.config, ARROW_GAME_DATA.canvas);
    const ignoredCollisionPairs = this.getInitialCollisionPairs(item);
    const stepSize = getCollisionSampleStep(item.config);
    const sampleCount = Math.max(1, Math.ceil(path.totalDistance / stepSize));

    for (let index = 1; index <= sampleCount; index += 1) {
      const sampleDistance = (path.totalDistance * index) / sampleCount;
      const visiblePoints = getSnakeVisiblePoints(path, sampleDistance);
      const commands = getVisibleArrowPathCommands(item.config, visiblePoints);
      const movingPolygon = this.commandsToScenePolygon(commands, 0, 0);
      const movingBounds = getBoundsFromPoints(movingPolygon);

      for (const blocker of this.items) {
        if (
          blocker === item ||
          !blocker.graphics.active ||
          blocker.scenePoints.length < 3
        ) {
          continue;
        }

        const pairKey = getCollisionPairKey(item.config.id, blocker.config.id);
        const blockerBounds = getBoundsFromPoints(blocker.scenePoints);

        if (!boundsOverlap(movingBounds, blockerBounds)) {
          ignoredCollisionPairs.delete(pairKey);
          continue;
        }

        if (!polygonsOverlap(movingPolygon, blocker.scenePoints)) {
          ignoredCollisionPairs.delete(pairKey);
          continue;
        }

        if (!ignoredCollisionPairs.has(pairKey)) {
          return false;
        }
      }
    }

    return true;
  }

  updateHandTapSize() {
    if (!this.handTap?.active) {
      return;
    }

    const unit = getVmin(this.scene);
    const width =
      (unit * HAND_TAP_WIDTH_VMIN * (this.handTapScale ?? 1)) / this.viewScale;
    const texture = this.scene.textures
      .get(HAND_TAP_TEXTURE_KEY)
      .getSourceImage();
    const height = width * (texture.height / texture.width);

    this.handTap.setDisplaySize(width, height);
  }

  playHandTapScaleDown() {
    const scale = { value: 1 };

    this.handTapTween?.stop();
    this.handTapTween = this.scene.tweens.add({
      targets: scale,
      value: HAND_TAP_END_SCALE,
      duration: HAND_TAP_SCALE_DURATION,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.handTapScale = scale.value;
        this.updateHandTapSize();
      },
    });
  }

  hideHandTap() {
    if (!this.handTap?.active) {
      return false;
    }

    this.handTapTween?.stop();
    this.handTap.destroy();
    this.handTap = null;
    return true;
  }

  resetInputState() {
    this.dragPointerId = null;
    this.dragDistance = 0;
    this.dragHoldStartTime = 0;
    this.dragArmed = false;
    this.pinchStartDistance = 0;
    this.pinchActive = false;
    this.focusTween?.stop();
  }

  destroy() {
    this.unbindPanZoomInput();
    this.focusTween?.stop();
    this.handTapTween?.stop();
    this.dragBorder.destroy();
    this.group.destroy(true);
    this.items = [];
  }

  getState() {
    const centerX = this.bounds.x + this.bounds.width / 2;
    const centerY = this.bounds.y + this.bounds.height / 2;
    const localX = (centerX - this.group.x) / this.viewScale;
    const localY = (centerY - this.group.y) / this.viewScale;

    return {
      completedIds: [...this.completedIds],
      failedIds: [...this.failedIds],
      handTapShown: this.handTapShown,
      view: {
        normalizedX: Phaser.Math.Clamp(
          (localX - this.offsetX) / this.gameWidth,
          0,
          1,
        ),
        normalizedY: Phaser.Math.Clamp(
          (localY - this.offsetY) / this.gameHeight,
          0,
          1,
        ),
        scale: this.viewScale,
      },
    };
  }

  bindPanZoomInput() {
    this.scene.input.addPointer(1);
    this.scene.input.on("pointerdown", this.handlePointerDown, this);
    this.scene.input.on("pointermove", this.handlePointerMove, this);
    this.scene.input.on("pointerup", this.handlePointerUp, this);
    this.scene.input.on("wheel", this.handleWheel, this);
  }

  unbindPanZoomInput() {
    this.scene.input.off("pointerdown", this.handlePointerDown, this);
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("wheel", this.handleWheel, this);
  }

  handlePointerDown(pointer) {
    if (!this.canUseBoardInput()) {
      return;
    }

    this.focusTween?.stop();
    this.dragPointerId = pointer.id;
    this.dragDistance = 0;
    this.lastDragX = pointer.x;
    this.lastDragY = pointer.y;
    this.dragHoldStartTime = pointer.downTime || this.scene.time.now;
    this.dragArmed = false;
    this.pinchActive = false;
    this.pinchStartDistance = 0;
  }

  handlePointerMove(pointer) {
    if (!this.canUseBoardInput()) {
      this.resetDragState();
      return;
    }

    const pointer1 = this.scene.input.pointer1;
    const pointer2 = this.scene.input.pointer2;

    if (pointer1?.isDown && pointer2?.isDown) {
      this.handlePinchZoom(pointer1, pointer2);
      return;
    }

    this.pinchStartDistance = 0;
    this.pinchActive = false;

    if (!pointer.isDown) {
      return;
    }

    if (this.dragPointerId === null) {
      this.dragPointerId = pointer.id;
      this.lastDragX = pointer.x;
      this.lastDragY = pointer.y;
      this.dragHoldStartTime = pointer.downTime || this.scene.time.now;
      this.dragArmed = false;
      return;
    }

    if (this.dragPointerId !== pointer.id) {
      return;
    }

    if (!this.dragArmed) {
      const downTime = pointer.downTime || this.dragHoldStartTime;
      const heldMs = this.scene.time.now - downTime;

      if (heldMs < DRAG_HOLD_DELAY) {
        this.lastDragX = pointer.x;
        this.lastDragY = pointer.y;
        return;
      }

      this.dragArmed = true;
    }

    const dx = (pointer.x - this.lastDragX) * DRAG_SENSITIVITY;
    const dy = (pointer.y - this.lastDragY) * DRAG_SENSITIVITY;

    this.group.x += dx;
    this.group.y += dy;
    this.clampGroupPosition();
    this.dragDistance += Math.hypot(dx, dy);
    this.lastDragX = pointer.x;
    this.lastDragY = pointer.y;
  }

  handlePointerUp(pointer) {
    if (this.dragPointerId === pointer.id) {
      this.resetDragState();
    }

    if (
      !this.scene.input.pointer1?.isDown &&
      !this.scene.input.pointer2?.isDown
    ) {
      this.pinchStartDistance = 0;
      this.pinchActive = false;
    }
  }

  handleWheel(pointer, gameObjects, deltaX, deltaY) {
    if (!this.canUseBoardInput()) {
      return;
    }

    this.focusTween?.stop();
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;

    this.zoomAt(pointer.x, pointer.y, this.viewScale * zoomFactor);
  }

  handlePinchZoom(pointer1, pointer2) {
    if (!this.canUseBoardInput()) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      pointer1.x,
      pointer1.y,
      pointer2.x,
      pointer2.y,
    );
    const centerX = (pointer1.x + pointer2.x) / 2;
    const centerY = (pointer1.y + pointer2.y) / 2;

    if (this.pinchStartDistance === 0) {
      this.focusTween?.stop();
      this.pinchStartDistance = distance;
      this.pinchStartScale = this.viewScale;
      this.pinchActive = true;
      return;
    }

    this.pinchActive = true;
    this.zoomAt(
      centerX,
      centerY,
      this.pinchStartScale * (distance / this.pinchStartDistance),
    );
  }

  resetDragState() {
    this.dragPointerId = null;
    this.dragHoldStartTime = 0;
    this.dragArmed = false;
  }

  zoomAt(x, y, targetScale) {
    const nextScale = Phaser.Math.Clamp(
      targetScale,
      MIN_VIEW_SCALE,
      MAX_VIEW_SCALE,
    );
    const localX = (x - this.group.x) / this.viewScale;
    const localY = (y - this.group.y) / this.viewScale;

    this.viewScale = nextScale;
    this.group.setScale(nextScale);
    this.group.setPosition(x - localX * nextScale, y - localY * nextScale);
    this.updateHandTapSize();
    this.clampGroupPosition();
  }

  focusBoardPoint(normalizedX, normalizedY, targetScale, duration, onComplete) {
    const nextScale = Phaser.Math.Clamp(
      targetScale,
      MIN_VIEW_SCALE,
      MAX_VIEW_SCALE,
    );
    const localX = this.offsetX + this.gameWidth * normalizedX;
    const localY = this.offsetY + this.gameHeight * normalizedY;
    const centerX = this.bounds.x + this.bounds.width / 2;
    const centerY = this.bounds.y + this.bounds.height / 2;
    const targetPosition = this.getClampedGroupPosition(
      centerX - localX * nextScale,
      centerY - localY * nextScale,
      nextScale,
    );
    const view = {
      x: this.group.x,
      y: this.group.y,
      scale: this.viewScale,
    };

    this.focusTween?.stop();
    this.focusTween = this.scene.tweens.add({
      targets: view,
      x: targetPosition.x,
      y: targetPosition.y,
      scale: nextScale,
      duration,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.viewScale = view.scale;
        this.group.setScale(view.scale);
        this.group.setPosition(view.x, view.y);
        this.updateHandTapSize();
        this.clampGroupPosition();
      },
      onComplete,
    });
  }

  setViewState(view) {
    const nextScale = Phaser.Math.Clamp(
      view.scale,
      MIN_VIEW_SCALE,
      MAX_VIEW_SCALE,
    );
    const localX = this.offsetX + this.gameWidth * view.normalizedX;
    const localY = this.offsetY + this.gameHeight * view.normalizedY;
    const centerX = this.bounds.x + this.bounds.width / 2;
    const centerY = this.bounds.y + this.bounds.height / 2;
    const position = this.getClampedGroupPosition(
      centerX - localX * nextScale,
      centerY - localY * nextScale,
      nextScale,
    );

    this.viewScale = nextScale;
    this.group.setScale(nextScale);
    this.group.setPosition(position.x, position.y);
    this.updateHandTapSize();
  }

  clampGroupPosition() {
    const position = this.getClampedGroupPosition(
      this.group.x,
      this.group.y,
      this.viewScale,
    );

    this.group.setPosition(position.x, position.y);
  }

  getClampedGroupPosition(x, y, viewScale) {
    const scaledLeft = this.offsetX * viewScale;
    const scaledTop = this.offsetY * viewScale;
    const scaledWidth = this.gameWidth * viewScale;
    const scaledHeight = this.gameHeight * viewScale;
    const minX =
      this.dragBounds.x + this.dragBounds.width - scaledLeft - scaledWidth;
    const maxX = this.dragBounds.x - scaledLeft;
    const minY =
      this.dragBounds.y + this.dragBounds.height - scaledTop - scaledHeight;
    const maxY = this.dragBounds.y - scaledTop;

    const clampedX =
      scaledWidth <= this.dragBounds.width
        ? this.dragBounds.x +
          (this.dragBounds.width - scaledWidth) / 2 -
          scaledLeft
        : Phaser.Math.Clamp(x, minX, maxX);
    const clampedY =
      scaledHeight <= this.dragBounds.height
        ? this.dragBounds.y +
          (this.dragBounds.height - scaledHeight) / 2 -
          scaledTop
        : Phaser.Math.Clamp(y, minY, maxY);

    return {
      x: clampedX,
      y: clampedY,
    };
  }

  commandsToScenePolygon(commands, x, y) {
    return commandsToPoints(commands).map((point) =>
      this.toScenePoint(transformLocalPoint(point, x, y, 0)),
    );
  }

  showBlockedFeedback(item, onComplete) {
    item.blockedFeedback?.stop();
    const originalX = item.graphics.x;

    item.blockedFeedback = this.scene.tweens.add({
      targets: item.graphics,
      x: originalX + 10,
      duration: 55,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
      onComplete: () => {
        item.graphics.x = originalX;
        onComplete?.();
      },
    });
  }

  toScenePoint(point) {
    return new Phaser.Geom.Point(
      this.offsetX + point.x * this.scale,
      this.offsetY + point.y * this.scale,
    );
  }

  playSound(key) {
    if (!this.scene.cache.audio.exists(key)) {
      return;
    }

    this.scene.sound.play(key);
  }
}

function commandsToPoints(commands) {
  return commands.flatMap((command) => {
    if (command.type === "M" || command.type === "L") {
      return [{ x: command.x, y: command.y }];
    }
    return [];
  });
}

function hexToNumber(hex) {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function getVmin(scene) {
  return Math.min(scene.scale.width, scene.scale.height) / 100;
}

function getDragBounds(bounds, limits) {
  const width = Math.min(
    Math.max(bounds.width - limits.left - limits.right, 1),
    limits.maxWidth,
  );
  const height = Math.min(
    Math.max(bounds.height - limits.top - limits.bottom, 1),
    limits.maxHeight,
  );

  return {
    x:
      bounds.x +
      limits.left +
      (bounds.width - limits.left - limits.right - width) / 2,
    y:
      bounds.y +
      limits.top +
      (bounds.height - limits.top - limits.bottom - height) / 2,
    width,
    height,
  };
}

function getSnakeLaunchPath(config, bounds) {
  const bodyPoints = getConfigWorldCenterlinePoints(config);
  const bodyLength = getPolylineLength(bodyPoints);
  const tip = bodyPoints[bodyPoints.length - 1];
  const previous = bodyPoints[bodyPoints.length - 2];
  const exitVector = getUnitVector(previous, tip);
  const exitTarget = getArrowExitTarget(
    config,
    tip.x,
    tip.y,
    exitVector,
    bounds,
  );
  const exitDistance = exitTarget.distance + bodyLength;
  const exitPoint = {
    x: tip.x + exitVector.x * exitDistance,
    y: tip.y + exitVector.y * exitDistance,
  };

  return {
    points: bodyPoints.concat([exitPoint]),
    bodyLength,
    totalDistance: exitDistance,
  };
}

function getConfigWorldCenterlinePoints(config) {
  return getConfigLocalCenterlinePoints(config).map((point) =>
    transformLocalPoint(point, config.x, config.y, config.rotation || 0),
  );
}

function getConfigLocalCenterlinePoints(config) {
  const headLength = Math.max(
    0,
    Math.min(
      config.headLength ?? config.head ?? 0,
      Math.max(config.length - 1, 0),
    ),
  );
  const segments = [
    {
      direction: config.direction,
      size: Math.max(config.length - headLength, 0),
    },
    ...(config.turns || []).map((turn) => ({
      direction: turn.direction,
      size: Math.max(turn.size - headLength, 0),
    })),
  ];
  const points = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;

  segments.forEach((segment, index) => {
    const vector = getDirectionVector(segment.direction);
    const size =
      index === segments.length - 1 ? segment.size : segment.size + headLength;

    x += vector.x * size;
    y += vector.y * size;
    points.push({ x, y });
  });

  const centered = centerPoints(points);
  const last = centered[centered.length - 1];
  const finalVector = getDirectionVector(getFinalDirection(config));

  centered.push({
    x: last.x + finalVector.x * headLength,
    y: last.y + finalVector.y * headLength,
  });

  return centered;
}

function getFinalDirection(config) {
  const turns = config.turns || [];
  const lastTurn = turns[turns.length - 1];
  return lastTurn ? lastTurn.direction : config.direction;
}

function getDirectionVector(direction) {
  return {
    right: { x: 1, y: 0 },
    left: { x: -1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
  }[direction];
}

function centerPoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

  return points.map((point) => ({
    x: point.x - centerX,
    y: point.y - centerY,
  }));
}

function getSnakeVisiblePoints(path, traveledDistance) {
  return getPolylineSliceByDistance(
    path.points,
    traveledDistance,
    traveledDistance + path.bodyLength,
  );
}

function getVisibleArrowPathCommands(config, visiblePoints) {
  return pointsToCommands(
    getShapeFromVisibleCenterline(config, visiblePoints).outer,
  );
}

function getShapeFromVisibleCenterline(config, visiblePoints) {
  const cleanedPoints = visiblePoints.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = visiblePoints[index - 1];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5;
  });

  if (cleanedPoints.length === 1) {
    cleanedPoints.push({ ...cleanedPoints[0] });
  }

  const totalLength = getPolylineLength(cleanedPoints);
  const headLength = Math.min(
    config.headLength ?? config.head ?? 0,
    totalLength * 0.6,
  );
  const tip = cleanedPoints[cleanedPoints.length - 1];
  const base = getPointAtDistance(
    cleanedPoints,
    Math.max(totalLength - headLength, 0),
  );
  const bodyPoints = getPolylineSliceByDistance(
    cleanedPoints,
    0,
    Math.max(totalLength - headLength, 0),
  );
  const previousBase =
    bodyPoints.length > 1
      ? bodyPoints[bodyPoints.length - 2]
      : cleanedPoints[cleanedPoints.length - 2];
  const vector = getUnitVector(previousBase || base, tip);
  const perp = { x: -vector.y, y: vector.x };
  const outerBody = Math.max(config.thickness || 0, 1) * 0.5;
  const outerHead = Math.max(
    outerBody,
    (config.headWidth || config.head || config.thickness || 1) * 0.5,
  );
  const safeBodyPoints =
    bodyPoints.length > 1
      ? bodyPoints
      : [offsetPoint(base, vector, -Math.max(config.thickness || 0, 1)), base];
  const leftSide = getOffsetPolyline(safeBodyPoints, 1, outerBody);
  const rightSide = getOffsetPolyline(safeBodyPoints, -1, outerBody);

  return {
    outer: leftSide.concat(
      [
        offsetPoint(base, perp, outerHead),
        tip,
        offsetPoint(base, perp, -outerHead),
      ],
      rightSide.reverse(),
    ),
  };
}

function pointsToCommands(points) {
  return points
    .map((point, index) => ({
      type: index === 0 ? "M" : "L",
      x: point.x,
      y: point.y,
    }))
    .concat([{ type: "Z" }]);
}

function getPolylineLength(points) {
  let length = 0;

  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }

  return length;
}

function getPointAtDistance(points, distance) {
  let remaining = distance;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);

    if (remaining <= segmentLength) {
      const progress = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
    }

    remaining -= segmentLength;
  }

  return points[points.length - 1];
}

function getPolylineSliceByDistance(points, startDistance, endDistance) {
  const totalLength = getPolylineLength(points);
  const start = Math.min(Math.max(startDistance, 0), totalLength);
  const end = Math.min(Math.max(endDistance, start), totalLength);
  const slice = [getPointAtDistance(points, start)];
  let traveled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
    const nextTraveled = traveled + segmentLength;

    if (nextTraveled > start && nextTraveled < end) {
      slice.push(points[index]);
    }

    traveled = nextTraveled;
  }

  slice.push(getPointAtDistance(points, end));

  return slice.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = slice[index - 1];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5;
  });
}

function getOffsetPolyline(points, side, width) {
  return points.map((point, index) => {
    if (index === 0) {
      const vector = getUnitVector(points[0], points[1]);
      return offsetPoint(point, { x: -vector.y, y: vector.x }, side * width);
    }

    if (index === points.length - 1) {
      const vector = getUnitVector(points[index - 1], point);
      return offsetPoint(point, { x: -vector.y, y: vector.x }, side * width);
    }

    const prevVector = getUnitVector(points[index - 1], point);
    const nextVector = getUnitVector(point, points[index + 1]);
    const prevPerp = { x: -prevVector.y, y: prevVector.x };
    const nextPerp = { x: -nextVector.y, y: nextVector.x };
    const prevPoint = offsetPoint(point, prevPerp, side * width);
    const nextPoint = offsetPoint(point, nextPerp, side * width);

    return (
      getLineIntersection(prevPoint, prevVector, nextPoint, nextVector) ||
      nextPoint
    );
  });
}

function getUnitVector(from, to) {
  const x = to.x - from.x;
  const y = to.y - from.y;
  const length = Math.hypot(x, y) || 1;

  return {
    x: x / length,
    y: y / length,
  };
}

function getLineIntersection(pointA, vectorA, pointB, vectorB) {
  const cross = vectorA.x * vectorB.y - vectorA.y * vectorB.x;

  if (Math.abs(cross) < 0.0001) {
    return null;
  }

  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const t = (dx * vectorB.y - dy * vectorB.x) / cross;

  return {
    x: pointA.x + vectorA.x * t,
    y: pointA.y + vectorA.y * t,
  };
}

function offsetPoint(point, vector, amount) {
  return {
    x: point.x + vector.x * amount,
    y: point.y + vector.y * amount,
  };
}

function transformLocalPoint(point, x, y, rotation) {
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: x + point.x * cos - point.y * sin,
    y: y + point.x * sin + point.y * cos,
  };
}

function getArrowExitTarget(config, startX, startY, vector, bounds) {
  const margin = Math.max(
    120,
    config.length + config.headLength + config.headWidth,
  );
  const candidates = [];

  if (vector.x > 0.0001) {
    candidates.push((bounds.width + margin - startX) / vector.x);
  } else if (vector.x < -0.0001) {
    candidates.push((-margin - startX) / vector.x);
  }

  if (vector.y > 0.0001) {
    candidates.push((bounds.height + margin - startY) / vector.y);
  } else if (vector.y < -0.0001) {
    candidates.push((-margin - startY) / vector.y);
  }

  const distance = Math.max(...candidates.filter((value) => value > 0), margin);

  return {
    x: startX + vector.x * distance,
    y: startY + vector.y * distance,
    distance,
  };
}

function getReleaseDuration(distance, speed) {
  const pixelsPerSecond = 860 * Math.max(speed, 0.25);
  return Math.max(120, (distance / pixelsPerSecond) * 1000);
}

function getCollisionSampleStep(config) {
  return Math.min(
    Math.max(Math.max(config.thickness || 0, config.headWidth || 0) / 4, 2),
    8,
  );
}

function getCollisionPairKey(a, b) {
  return [a, b].sort((left, right) => left - right).join(":");
}

function polygonsOverlap(a, b) {
  if (a.length < 3 || b.length < 3) {
    return false;
  }

  if (!boundsOverlap(getBoundsFromPoints(a), getBoundsFromPoints(b))) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const nextIndex = (index + 1) % a.length;
    for (let targetIndex = 0; targetIndex < b.length; targetIndex += 1) {
      const targetNextIndex = (targetIndex + 1) % b.length;
      if (
        segmentsIntersect(
          a[index],
          a[nextIndex],
          b[targetIndex],
          b[targetNextIndex],
        )
      ) {
        return true;
      }
    }
  }

  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

function getBoundsFromPoints(points) {
  let left = points[0].x;
  let right = points[0].x;
  let top = points[0].y;
  let bottom = points[0].y;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }

  return { left, right, top, bottom };
}

function boundsOverlap(a, b) {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}

function segmentsIntersect(a, b, c, d) {
  const ab = orientation(a, b, c);
  const ad = orientation(a, b, d);
  const ca = orientation(c, d, a);
  const cb = orientation(c, d, b);

  if (ab !== ad && ca !== cb) {
    return true;
  }

  return (
    (ab === 0 && pointOnSegment(c, a, b)) ||
    (ad === 0 && pointOnSegment(d, a, b)) ||
    (ca === 0 && pointOnSegment(a, c, d)) ||
    (cb === 0 && pointOnSegment(b, c, d))
  );
}

function orientation(a, b, c) {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  if (Math.abs(value) < 0.0001) {
    return 0;
  }

  return value > 0 ? 1 : 2;
}

function pointOnSegment(point, a, b) {
  return (
    point.x <= Math.max(a.x, b.x) + 0.0001 &&
    point.x >= Math.min(a.x, b.x) - 0.0001 &&
    point.y <= Math.max(a.y, b.y) + 0.0001 &&
    point.y >= Math.min(a.y, b.y) - 0.0001
  );
}

function pointInPolygon(point, polygon) {
  let inside = false;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}
