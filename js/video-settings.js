export const DEFAULT_VIDEO_SETTINGS = Object.freeze({
  miniMap: true,
  cameraPanel: true,
});

export function normalizeVideoSettings(settings = {}) {
  return Object.fromEntries(Object.keys(DEFAULT_VIDEO_SETTINGS).map((key) => [
    key,
    typeof settings[key] === "boolean" ? settings[key] : DEFAULT_VIDEO_SETTINGS[key],
  ]));
}

export function applyVideoSettings(root, settings) {
  const normalized = normalizeVideoSettings(settings);
  if (root?.dataset) {
    root.dataset.showMiniMap = String(normalized.miniMap);
    root.dataset.showCameraPanel = String(normalized.cameraPanel);
  }
  return normalized;
}
