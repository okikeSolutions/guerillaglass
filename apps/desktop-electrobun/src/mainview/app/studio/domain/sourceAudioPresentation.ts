import type { TimelineWaveform } from "./timelineDomainModel";

export type SourceAudioStatus =
  | "idle"
  | "loading"
  | "no-audio"
  | "unavailable"
  | "silent"
  | "decoded";
export type SourceAudioPresentation =
  | { readonly status: "decoded"; readonly waveform: TimelineWaveform }
  | { readonly status: Exclude<SourceAudioStatus, "decoded">; readonly waveform: null };

/** Safari exposes embedded tracks; unsupported APIs leave presence unknown. */
export function readEmbeddedAudioTrackCount(media: HTMLMediaElement): number | null {
  const tracks = (media as HTMLMediaElement & { audioTracks?: { readonly length: number } })
    .audioTracks;
  return tracks && Number.isInteger(tracks.length) && tracks.length >= 0 ? tracks.length : null;
}
