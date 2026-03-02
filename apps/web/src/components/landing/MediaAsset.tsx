import * as React from "react";
import type { LandingMedia } from "../../content/landing";

type MediaAssetProps = {
  media: LandingMedia;
  className?: string;
  priority?: boolean;
};

export function MediaAsset({ media, className, priority = false }: MediaAssetProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (
      media.type !== "video" ||
      !videoRef.current ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const node = videoRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void node.play().catch(() => {
            // Playback can fail from browser policies; muted autoplay is attempted.
          });
        } else {
          node.pause();
        }
      },
      { rootMargin: "0px", threshold: 0.15 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      node.pause();
    };
  }, [media]);

  const classes = ["media-asset", className].filter(Boolean).join(" ");

  return (
    <figure className={classes} style={{ aspectRatio: media.aspectRatio }}>
      {media.type === "video" ? (
        <video
          aria-label={media.alt}
          autoPlay
          loop
          muted
          playsInline
          poster={media.poster}
          preload={priority ? "auto" : "metadata"}
          ref={videoRef}
        >
          <source src={media.src} type="video/mp4" />
        </video>
      ) : (
        <img
          alt={media.alt}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : media.preload}
          src={media.src}
        />
      )}
    </figure>
  );
}
