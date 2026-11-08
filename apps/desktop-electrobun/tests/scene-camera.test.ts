import { describe, expect, it } from "vitest";
import fixture from "../../../docs/fixtures/scene-camera.json";
import {
  sampleSceneCamera,
  sceneCameraCssTransform,
} from "../src/mainview/app/studio/domain/sceneCamera";

describe("scene camera preview/export parity", () => {
  it("matches the shared affine interpolation vectors and holds endpoints", () => {
    for (const sample of fixture.samples) {
      expect(sampleSceneCamera(fixture.camera, sample.timeSeconds)).toMatchObject({
        centerX: sample.centerX,
        centerY: sample.centerY,
        zoom: sample.zoom,
      });
    }
  });
  it("keeps the chosen source focus at the card center with letterboxing", () => {
    expect(
      sceneCameraCssTransform(
        { timeSeconds: 0, centerX: 0.75, centerY: 0.5, zoom: 2 },
        { width: 1600, height: 900 },
        { width: 400, height: 400 },
      ),
    ).toBe("matrix(2, 0, 0, 2, -200, 0)");
  });
});
