const introLightModules = import.meta.glob(
  "../media/images_introlightVariant_*.webp.js",
  { eager: true },
);

export const INTRO_LIGHT_FRAME_KEYS = Object.keys(introLightModules)
  .sort()
  .map((path) => {
    const match = path.match(/_(\d+)\.webp\.js$/);
    return `introLightFrame${match ? match[1] : ""}`;
  });

export const INTRO_LIGHT_FRAMES = Object.entries(introLightModules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([path, module]) => {
    const match = path.match(/_(\d+)\.webp\.js$/);

    return {
      key: `introLightFrame${match ? match[1] : ""}`,
      data: Object.values(module)[0],
    };
  });
