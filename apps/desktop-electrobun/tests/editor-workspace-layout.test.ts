import { describe, expect, it } from "bun:test";
import { createResizeHandleKeyDown } from "../src/mainview/app/studio/hooks/useEditorWorkspaceLayout";

function createKeyEvent(key: string, shiftKey = false) {
  let prevented = false;
  return {
    event: {
      key,
      shiftKey,
      preventDefault() {
        prevented = true;
      },
    },
    prevented: () => prevented,
  };
}

describe("editor workspace keydown factory", () => {
  it("uses horizontal arrow steps", () => {
    const deltas: number[] = [];
    const handler = createResizeHandleKeyDown({
      axis: "horizontal",
      stepPx: 8,
      largeStepPx: 32,
      onStep: (delta) => deltas.push(delta),
      onHome: () => void 0,
      onEnd: () => void 0,
    });

    const leftEvent = createKeyEvent("ArrowLeft");
    handler(leftEvent.event);
    const rightShiftEvent = createKeyEvent("ArrowRight", true);
    handler(rightShiftEvent.event);

    expect(deltas).toEqual([-8, 32]);
    expect(leftEvent.prevented()).toBe(true);
    expect(rightShiftEvent.prevented()).toBe(true);
  });

  it("supports inverted arrow semantics", () => {
    const deltas: number[] = [];
    const handler = createResizeHandleKeyDown({
      axis: "horizontal",
      stepPx: 8,
      largeStepPx: 32,
      invertArrows: true,
      onStep: (delta) => deltas.push(delta),
      onHome: () => void 0,
      onEnd: () => void 0,
    });

    handler(createKeyEvent("ArrowLeft").event);
    handler(createKeyEvent("ArrowRight").event);

    expect(deltas).toEqual([8, -8]);
  });

  it("routes Home and End to edge handlers", () => {
    let homeCalls = 0;
    let endCalls = 0;
    const handler = createResizeHandleKeyDown({
      axis: "vertical",
      stepPx: 8,
      largeStepPx: 32,
      onStep: () => void 0,
      onHome: () => {
        homeCalls += 1;
      },
      onEnd: () => {
        endCalls += 1;
      },
    });

    handler(createKeyEvent("Home").event);
    handler(createKeyEvent("End").event);

    expect(homeCalls).toBe(1);
    expect(endCalls).toBe(1);
  });
});
