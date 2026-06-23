const TARGET_ASPECT_RATIO = 16 / 9;
const EXTREME_RATIO_THRESHOLD = 1.8;
const END_SCENE_BODY_BACKGROUND = "#000000";
const CTA_RESIZE_TAP_BLOCK_DURATION = 350;
const CTA_TAP_MAX_DRAG = 24;

export class EndScene {
  constructor({
    srcPortrait,
    srcLandscape,
    clickUrl = "",
    muted = true,
    playsInline = true,
    autoPlay = true,
    loop = true,
  } = {}) {
    this.srcPortrait = srcPortrait;
    this.srcLandscape = srcLandscape;
    this.clickUrl = clickUrl;
    this.autoPlay = autoPlay;

    this.rafId = 0;
    this.containerSize = { widthPct: 100, heightPct: 100 };
    this.activeSrc = null;
    this.destroyed = false;
    this.pointerDown = null;
    this.inputBlockedUntil = 0;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleClickAction = this.handleClickAction.bind(this);
    this.scheduleOrientationUpdate = this.scheduleOrientationUpdate.bind(this);
    this.syncWindowActivityState = this.syncWindowActivityState.bind(this);

    const container = document.createElement("div");
    container.id = "video-container";
    Object.assign(container.style, {
      position: "fixed",
      left: "50%",
      top: "50%",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transform: "translate(-50%, -50%)",
      width: "100%",
      height: "100%",
      background: END_SCENE_BODY_BACKGROUND,
      zIndex: "9999",
    });

    const video = document.createElement("video");
    video.id = "sip-video";
    video.muted = muted;
    video.loop = loop;
    video.autoplay = autoPlay;
    video.playsInline = playsInline;
    if (muted) video.setAttribute("muted", "");
    if (loop) video.setAttribute("loop", "");
    if (autoPlay) video.setAttribute("autoplay", "");
    if (playsInline) {
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
    }
    Object.assign(video.style, {
      width: "130%",
      height: "100%",
      objectFit: "contain",
      display: "block",
    });

    container.appendChild(video);
    document.body.appendChild(container);

    this.container = container;
    this.video = video;

    const appEl = document.getElementById("app");
    if (appEl) {
      this.appEl = appEl;
      this.previousAppDisplay = appEl.style.display;
      appEl.style.display = "none";
    }
    this.previousBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = END_SCENE_BODY_BACKGROUND;

    this.attach();
    this.computeLayout();
    this.syncWindowActivityState();
  }

  handlePointerDown(event) {
    if (!this.isValidPointerEvent(event)) {
      this.pointerDown = null;
      return;
    }

    this.pointerDown = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  handleClickAction(event) {
    if (!this.isValidTap(event)) {
      return;
    }

    this.pointerDown = null;
    const mraid = window.mraid || {};
    if (mraid.open && typeof mraid.open === "function") {
      if (this.clickUrl) mraid.open(this.clickUrl);
      else mraid.open();
      return;
    }
    if (this.clickUrl) {
      window.open(this.clickUrl, "_blank", "noopener,noreferrer");
    } else {
      window.open();
    }
  }

  computeLayout() {
    if (this.destroyed) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;
    const src = isPortrait ? this.srcPortrait : this.srcLandscape;
    const normalizedRatio = width > height ? width / height : height / width;

    let widthPct = 100;
    let heightPct = 100;

    if (normalizedRatio > EXTREME_RATIO_THRESHOLD) {
      if (isPortrait) {
        const targetHeight = width * TARGET_ASPECT_RATIO;
        heightPct = (targetHeight / height) * 100;
      } else {
        const targetWidth = height * TARGET_ASPECT_RATIO;
        widthPct = (targetWidth / width) * 100;
      }
    }

    if (
      this.containerSize.widthPct !== widthPct ||
      this.containerSize.heightPct !== heightPct
    ) {
      this.containerSize = { widthPct, heightPct };
      this.container.style.width = `${widthPct}%`;
      this.container.style.height = `${heightPct}%`;
    }

    if (!src || this.activeSrc === src) return;
    this.activeSrc = src;
    this.video.src = src;
    this.video.load();
  }

  scheduleOrientationUpdate() {
    this.pointerDown = null;
    this.inputBlockedUntil = performance.now() + CTA_RESIZE_TAP_BLOCK_DURATION;
    if (this.rafId) return;
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = 0;
      this.computeLayout();
    });
  }

  syncWindowActivityState() {
    if (this.destroyed) return;
    const isActive = document.visibilityState === "visible";
    if (isActive) {
      this.scheduleOrientationUpdate();
      if (this.autoPlay) this.video.play().catch(() => {});
    } else {
      this.video.pause();
      if (this.rafId) {
        window.cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    }
  }

  attach() {
    window.addEventListener("resize", this.scheduleOrientationUpdate, {
      passive: true,
    });
    window.addEventListener(
      "orientationchange",
      this.scheduleOrientationUpdate,
      { passive: true },
    );
    this.container.addEventListener("pointerdown", this.handlePointerDown);
    this.container.addEventListener("pointerup", this.handleClickAction);
    document.addEventListener("visibilitychange", this.syncWindowActivityState);
    window.addEventListener("focus", this.syncWindowActivityState);
    window.addEventListener("blur", this.syncWindowActivityState);
    window.addEventListener("pagehide", this.syncWindowActivityState);
  }

  detach() {
    window.removeEventListener("resize", this.scheduleOrientationUpdate);
    window.removeEventListener(
      "orientationchange",
      this.scheduleOrientationUpdate,
    );
    this.container.removeEventListener("pointerdown", this.handlePointerDown);
    this.container.removeEventListener("pointerup", this.handleClickAction);
    document.removeEventListener(
      "visibilitychange",
      this.syncWindowActivityState,
    );
    window.removeEventListener("focus", this.syncWindowActivityState);
    window.removeEventListener("blur", this.syncWindowActivityState);
    window.removeEventListener("pagehide", this.syncWindowActivityState);
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detach();
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.appEl) {
      this.appEl.style.display = this.previousAppDisplay || "";
    }
    document.body.style.backgroundColor = this.previousBodyBackground || "";
  }

  isValidPointerEvent(event) {
    return (
      event &&
      event.isTrusted !== false &&
      event.isPrimary !== false &&
      performance.now() >= this.inputBlockedUntil &&
      event.target instanceof Node &&
      this.container.contains(event.target)
    );
  }

  isValidTap(event) {
    const down = this.pointerDown;

    if (
      !down ||
      !this.isValidPointerEvent(event) ||
      event.pointerId !== down.id
    ) {
      this.pointerDown = null;
      return false;
    }

    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;

    if (dx * dx + dy * dy > CTA_TAP_MAX_DRAG * CTA_TAP_MAX_DRAG) {
      this.pointerDown = null;
      return false;
    }

    return true;
  }
}
