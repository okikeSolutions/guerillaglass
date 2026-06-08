import { Context, Effect, FileSystem, Layer } from "effect";

export type DesktopTempDirectoryService = {
  readonly path: string;
};

export class DesktopTempDirectory extends Context.Service<
  DesktopTempDirectory,
  DesktopTempDirectoryService
>()("@guerillaglass/desktop/DesktopTempDirectory") {}

/** App-owned scoped temporary directory for desktop backend file/media policy. */
export const layerDesktopTempDirectory = Layer.effect(
  DesktopTempDirectory,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const directoryPath = yield* fs.makeTempDirectoryScoped({ prefix: "guerillaglass-" });
    yield* Effect.logInfo("desktop temp directory created", { path: directoryPath });
    return DesktopTempDirectory.of({ path: directoryPath });
  }),
);
