import { normalizeStudioLocale, type StudioLocale } from "./studio";

export type DesktopMenuMessages = {
  file: string;
  openProject: string;
  saveProject: string;
  saveProjectAs: string;
  export: string;
  edit: string;
  capture: string;
  startRecording: string;
  stopRecording: string;
  startPreview: string;
  stopPreview: string;
  refreshSources: string;
  timeline: string;
  playPause: string;
  setTrimIn: string;
  setTrimOut: string;
  toggleTimeline: string;
  view: string;
  language: string;
  languageEnglish: string;
  languageGerman: string;
  density: string;
  densityComfortable: string;
  densityCompact: string;
  toggleDeveloperTools: string;
  window: string;
  help: string;
  documentation: string;
  quit: string;
};

const desktopMenuMessagesByLocale: Record<StudioLocale, DesktopMenuMessages> = {
  "en-US": {
    file: "File",
    openProject: "Open Project...",
    saveProject: "Save Project",
    saveProjectAs: "Save Project As...",
    export: "Export...",
    edit: "Edit",
    capture: "Capture",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    startPreview: "Start Preview",
    stopPreview: "Stop Preview",
    refreshSources: "Refresh Sources",
    timeline: "Timeline",
    playPause: "Play/Pause",
    setTrimIn: "Set Trim In",
    setTrimOut: "Set Trim Out",
    toggleTimeline: "Toggle Timeline",
    view: "View",
    language: "Language",
    languageEnglish: "English (US)",
    languageGerman: "Deutsch (DE)",
    density: "Density",
    densityComfortable: "Comfortable",
    densityCompact: "Compact",
    toggleDeveloperTools: "Toggle Developer Tools",
    window: "Window",
    help: "Help",
    documentation: "Guerillaglass Documentation",
    quit: "Quit",
  },
  "de-DE": {
    file: "Datei",
    openProject: "Projekt öffnen...",
    saveProject: "Projekt speichern",
    saveProjectAs: "Projekt speichern unter...",
    export: "Exportieren...",
    edit: "Bearbeiten",
    capture: "Aufnahme",
    startRecording: "Aufnahme starten",
    stopRecording: "Aufnahme stoppen",
    startPreview: "Vorschau starten",
    stopPreview: "Vorschau stoppen",
    refreshSources: "Quellen aktualisieren",
    timeline: "Zeitleiste",
    playPause: "Wiedergabe/Pause",
    setTrimIn: "Trim-In setzen",
    setTrimOut: "Trim-Out setzen",
    toggleTimeline: "Zeitleiste umschalten",
    view: "Ansicht",
    language: "Sprache",
    languageEnglish: "English (US)",
    languageGerman: "Deutsch (DE)",
    density: "Dichte",
    densityComfortable: "Komfortabel",
    densityCompact: "Kompakt",
    toggleDeveloperTools: "Entwicklerwerkzeuge umschalten",
    window: "Fenster",
    help: "Hilfe",
    documentation: "Guerillaglass-Dokumentation",
    quit: "Beenden",
  },
};

export function getDesktopMenuMessages(locale: string | null | undefined): DesktopMenuMessages {
  return desktopMenuMessagesByLocale[normalizeStudioLocale(locale)];
}
