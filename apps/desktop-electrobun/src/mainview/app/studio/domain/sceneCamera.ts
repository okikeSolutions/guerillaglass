import type { SceneCameraKeyframe } from "@guerillaglass/engine-contract/shared/valueObjects";

/** Interpolates affine camera transforms with endpoint holds, matching native export. */
export function sampleSceneCamera(
  camera: readonly SceneCameraKeyframe[],
  time: number,
): SceneCameraKeyframe | null {
  const first = camera[0];
  if (!first) {
    return null;
  }
  if (time <= first.timeSeconds) {
    return first;
  }
  let previous = first;
  for (const next of camera.slice(1)) {
    if (time <= next.timeSeconds) {
      const progress = (time - previous.timeSeconds) / (next.timeSeconds - previous.timeSeconds);
      const zoom = previous.zoom + (next.zoom - previous.zoom) * progress;
      return {
        timeSeconds: time,
        centerX:
          (previous.centerX * previous.zoom * (1 - progress) +
            next.centerX * next.zoom * progress) /
          zoom,
        centerY:
          (previous.centerY * previous.zoom * (1 - progress) +
            next.centerY * next.zoom * progress) /
          zoom,
        zoom,
      };
    }
    previous = next;
  }
  return previous;
}

/** CSS transform of an aspect-fit source inside the current preview card. */
export function sceneCameraCssTransform(
  key: SceneCameraKeyframe,
  source: { width: number; height: number },
  card: { width: number; height: number },
): string {
  const fitScale = Math.min(card.width / source.width, card.height / source.height);
  const x = (0.5 - key.centerX) * source.width * fitScale * key.zoom;
  const y = (0.5 - key.centerY) * source.height * fitScale * key.zoom;
  return `matrix(${key.zoom}, 0, 0, ${key.zoom}, ${x}, ${y})`;
}
