import { Layer } from "effect";
import type { EngineClient } from "../service";
import { AgentService, layerAgentService } from "./AgentService";
import { CaptureService, layerCaptureService } from "./CaptureService";
import { ExportService, layerExportService } from "./ExportService";
import { PermissionsService, layerPermissionsService } from "./PermissionsService";
import { ProjectService, layerProjectService } from "./ProjectService";
import { RecordingService, layerRecordingService } from "./RecordingService";
import { SourcesService, layerSourcesService } from "./SourcesService";
import { SystemService, layerSystemService } from "./SystemService";

/** Domain-oriented engine services exposed to application layers. */
export type EngineDomainServices =
  | AgentService
  | CaptureService
  | ExportService
  | PermissionsService
  | ProjectService
  | RecordingService
  | SourcesService
  | SystemService;

/**
 * Derives all engine domain services from the low-level EngineClient.
 *
 * Application code should consume these domain services; the low-level client
 * should stay at composition boundaries.
 */
export const layerEngineDomainServices: Layer.Layer<EngineDomainServices, never, EngineClient> =
  Layer.mergeAll(
    layerSystemService,
    layerPermissionsService,
    layerSourcesService,
    layerCaptureService,
    layerRecordingService,
    layerProjectService,
    layerExportService,
    layerAgentService,
  );
