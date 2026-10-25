export const easeDrawer = [0.32, 0.72, 0, 1] as const;
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
export const reduceMotion = () =>
  motionPreference.matches ||
  document.documentElement.dataset.input === "keyboard";
