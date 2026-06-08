import { useEffect, useRef } from "react";
import { sendHostStudioDiagnostics } from "./lib/engine";
import { captureBenchmarkWindowTitle } from "../shared/captureBenchmark";

export function CaptureBenchmarkScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    let animationFrameId = 0;

    const resize = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(window.innerWidth * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(window.innerHeight * devicePixelRatio));
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const render = () => {
      frame += 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      context.fillStyle = `hsl(${frame % 360} 60% 10%)`;
      context.fillRect(0, 0, width, height);

      for (let index = 0; index < 16; index += 1) {
        const x = ((frame * (2 + index * 0.15) + index * 80) % (width + 240)) - 120;
        const y = ((height / 16) * index + Math.sin((frame + index * 18) / 16) * 22) % height;
        context.fillStyle = `hsl(${(frame * 2 + index * 23) % 360} 90% 60%)`;
        context.fillRect(x, y, 240, 28);
      }

      context.fillStyle = "#ffffff";
      context.font = "600 40px system-ui";
      context.fillText(captureBenchmarkWindowTitle, 40, 72);
      context.font = "500 28px system-ui";
      context.fillText(`frame ${frame}`, 40, 118);

      animationFrameId = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrameId = window.requestAnimationFrame(render);

    const readyFrameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sendHostStudioDiagnostics({
          source: "renderer",
          level: "INFO",
          message: "capture-benchmark-ready",
          timestamp: new Date().toISOString(),
          annotations: {
            title: captureBenchmarkWindowTitle,
            phase: "painted",
          },
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(readyFrameId);
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#0b1020",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label={captureBenchmarkWindowTitle}
        style={{ display: "block", width: "100vw", height: "100vh" }}
      />
    </main>
  );
}
