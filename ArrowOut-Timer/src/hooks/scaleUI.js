export function scaleUI({ app, wrapper, baseW = 1080, baseH = 2290 } = {}) {
  if (!app || !wrapper) {
    throw new Error("scaleUI: 'app' and 'wrapper' elements are required");
  }

  app.style.width = `${baseW}px`;
  app.style.height = `${baseH}px`;

  let frameId = null;

  const applyScale = () => {
    frameId = null;

    const { width: viewportW, height: viewportH } =
      wrapper.getBoundingClientRect();

    if (!viewportW || !viewportH) return;

    const scale = Math.min(viewportW / baseW, viewportH / baseH);

    wrapper.style.setProperty("--ui-scale", scale.toString());
  };

  const scheduleScale = () => {
    if (frameId !== null) return;
    frameId = requestAnimationFrame(applyScale);
  };

  scheduleScale();

  const ro = new ResizeObserver(scheduleScale);
  ro.observe(wrapper);

  window.addEventListener("orientationchange", scheduleScale);

  return () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    ro.disconnect();
    window.removeEventListener("orientationchange", scheduleScale);
  };
}
