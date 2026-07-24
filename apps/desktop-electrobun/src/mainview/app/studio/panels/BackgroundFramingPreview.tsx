import type { BackgroundFramingSettings } from "@guerillaglass/engine-contract/shared/valueObjects";
import { useCallback, useMemo, useSyncExternalStore, type ReactNode, type Ref } from "react";
import {
  computeBackgroundFramingGeometry,
  type RenderSize,
} from "../domain/backgroundFramingGeometry";

const emptySize: RenderSize = Object.freeze({ width: 0, height: 0 });

class ElementSizeStore {
  private element: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private snapshot: RenderSize = emptySize;
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): RenderSize => this.snapshot;

  readonly setElement = (element: HTMLElement | null): void => {
    if (this.element === element) {
      return;
    }
    this.observer?.disconnect();
    this.element = element;
    this.observer = null;
    if (!element) {
      this.update(emptySize);
      return;
    }

    this.measure(element);
    this.observer = new ResizeObserver(() => this.measure(element));
    this.observer.observe(element);
  };

  private measure(element: HTMLElement): void {
    const bounds = element.getBoundingClientRect();
    this.update({ width: bounds.width, height: bounds.height });
  }

  private update(size: RenderSize): void {
    if (size.width === this.snapshot.width && size.height === this.snapshot.height) {
      return;
    }
    this.snapshot = Object.freeze(size);
    for (const listener of this.listeners) {
      listener();
    }
  }
}

type BackgroundFramingPreviewProps = {
  settings: BackgroundFramingSettings;
  outputSize: RenderSize;
  sourceSize: RenderSize;
  cardRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

export function BackgroundFramingPreview({
  settings,
  outputSize,
  sourceSize,
  cardRef,
  children,
}: BackgroundFramingPreviewProps) {
  const sizeStore = useMemo(() => new ElementSizeStore(), []);
  const measuredSize = useSyncExternalStore(
    sizeStore.subscribe,
    sizeStore.getSnapshot,
    () => emptySize,
  );
  const setStageElement = useCallback(
    (element: HTMLDivElement | null) => sizeStore.setElement(element),
    [sizeStore],
  );
  const geometry = computeBackgroundFramingGeometry(outputSize, sourceSize, settings);
  const scale = measuredSize.width > 0 ? measuredSize.width / outputSize.width : 0;
  const card = geometry?.cardRect;

  return (
    <div
      ref={setStageElement}
      className="relative h-full w-full overflow-hidden rounded-md"
      data-testid="background-framing-stage"
      data-framing-enabled={settings.enabled}
      style={{ backgroundColor: settings.enabled ? settings.backgroundColor : undefined }}
    >
      {card ? (
        <div
          ref={cardRef}
          className="absolute overflow-hidden"
          data-testid="background-framing-card"
          style={{
            left: card.x * scale,
            top: card.y * scale,
            width: card.width * scale,
            height: card.height * scale,
            borderRadius: (geometry?.cornerRadius ?? 0) * scale,
            boxShadow: settings.enabled
              ? `${(geometry?.shadowOffsetX ?? 0) * scale}px ${(geometry?.shadowOffsetY ?? 0) * scale}px ${(geometry?.shadowBlurRadius ?? 0) * scale}px rgba(0, 0, 0, ${geometry?.shadowOpacity ?? 0})`
              : undefined,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
