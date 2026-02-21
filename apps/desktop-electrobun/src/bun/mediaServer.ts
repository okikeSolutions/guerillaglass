import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";

const mediaExtensions = new Set([".mov", ".mp4", ".m4v", ".webm"]);
const passThroughSchemes = new Set(["stub:"]);
const mediaTokenTtlMs = 30 * 60 * 1000;
const maxMediaTokens = 512;
const maxTokenPathSegmentLength = 160;
const mediaServerPortFloor = 49_152;
const mediaServerPortCeiling = 65_535;
const mediaServerMaxBindAttempts = 10;

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ByteRange = {
  start: number;
  end: number;
};

type MediaTokenEntry = {
  filePath: string;
  createdAt: number;
};

function hasUrlScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function canPassThroughMediaURL(value: string): boolean {
  try {
    return passThroughSchemes.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isWindowsDrivePath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function normalizeMediaPath(filePath: string): string {
  const normalizedSlashes = filePath.split("\\").join(path.sep);
  if (path.isAbsolute(normalizedSlashes)) {
    return path.normalize(normalizedSlashes);
  }
  return path.resolve(normalizedSlashes);
}

function fileURLToLocalPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:") {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname && hostname !== "localhost" && process.platform !== "win32") {
      return null;
    }

    const decodedPathname = decodeURIComponent(url.pathname);
    if (process.platform === "win32") {
      const winPath = decodedPathname.split("/").join("\\");
      if (hostname && hostname !== "localhost") {
        return path.normalize(`\\\\${url.hostname}${winPath}`);
      }
      if (/^\\[a-zA-Z]:\\/.test(winPath)) {
        return path.normalize(winPath.slice(1));
      }
      return path.normalize(winPath);
    }

    if (hostname && hostname !== "localhost") {
      return path.normalize(`//${url.hostname}${decodedPathname}`);
    }
    return path.normalize(decodedPathname);
  } catch {
    return null;
  }
}

function parseByteRange(rangeHeader: string, size: number): ByteRange | null {
  if (rangeHeader.includes(",")) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";
  if (rawStart.length === 0 && rawEnd.length === 0) {
    return null;
  }

  if (rawStart.length === 0) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const start = Math.max(size - suffixLength, 0);
    const end = size - 1;
    return start <= end ? { start, end } : null;
  }

  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd.length > 0 ? Number.parseInt(rawEnd, 10) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null;
  }
  if (start >= size) {
    return null;
  }
  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function mediaTypeForPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".mov":
      return "video/quicktime";
    case ".mp4":
      return "video/mp4";
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function isAddressInUse(error: unknown): boolean {
  const typedError = error as { code?: string; message?: string };
  if (typedError?.code === "EADDRINUSE") {
    return true;
  }
  return (
    typeof typedError?.message === "string" &&
    typedError.message.toUpperCase().includes("EADDRINUSE")
  );
}

function isUnsupportedPortZeroError(error: unknown): boolean {
  const typedError = error as { code?: string; message?: string };
  if (typedError?.code === "EINVAL") {
    return true;
  }
  return typeof typedError?.message === "string" && typedError.message.includes("port 0");
}

function randomLoopbackPort(): number {
  const span = mediaServerPortCeiling - mediaServerPortFloor + 1;
  return mediaServerPortFloor + Math.floor(Math.random() * span);
}

async function reserveLoopbackPort(host: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host, port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to reserve loopback media server port.")));
        return;
      }
      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function mediaSecurityHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
}

export class MediaServer {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private origin: string | null = null;
  private readonly tokens = new Map<string, MediaTokenEntry>();

  private async ensureServer(): Promise<void> {
    if (this.server && this.origin) {
      return;
    }
    const host = "127.0.0.1";
    let lastError: unknown;
    try {
      this.server = Bun.serve({
        hostname: host,
        port: 0,
        fetch: (request) => this.handleRequest(request),
      });
      this.origin = `http://${host}:${this.server.port}`;
      return;
    } catch (error) {
      lastError = error;
      if (!isUnsupportedPortZeroError(error) && !isAddressInUse(error)) {
        throw error;
      }
    }

    for (let attempt = 0; attempt < mediaServerMaxBindAttempts; attempt += 1) {
      let port: number;
      try {
        port = await reserveLoopbackPort(host);
      } catch {
        port = randomLoopbackPort();
      }
      try {
        this.server = Bun.serve({
          hostname: host,
          port,
          fetch: (request) => this.handleRequest(request),
        });
        this.origin = `http://${host}:${this.server.port}`;
        return;
      } catch (error) {
        lastError = error;
        if (!isAddressInUse(error)) {
          throw error;
        }
      }
    }
    throw lastError ?? new Error("Unable to bind media playback server.");
  }

  private pruneTokens(): void {
    const now = Date.now();
    for (const [token, entry] of this.tokens) {
      if (now - entry.createdAt > mediaTokenTtlMs) {
        this.tokens.delete(token);
      }
    }
    while (this.tokens.size > maxMediaTokens) {
      const firstToken = this.tokens.keys().next().value;
      if (!firstToken) {
        break;
      }
      this.tokens.delete(firstToken);
    }
  }

  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          ...mediaSecurityHeaders(),
          allow: "GET, HEAD",
        },
      });
    }

    if (!isLoopbackHost(url.hostname)) {
      return new Response("Forbidden", {
        status: 403,
        headers: mediaSecurityHeaders(),
      });
    }

    const tokenPrefix = "/media/";
    if (!url.pathname.startsWith(tokenPrefix)) {
      return new Response("Not found", { status: 404, headers: mediaSecurityHeaders() });
    }

    const encodedToken = url.pathname.slice(tokenPrefix.length);
    if (encodedToken.length === 0 || encodedToken.length > maxTokenPathSegmentLength) {
      return new Response("Bad request", { status: 400, headers: mediaSecurityHeaders() });
    }

    let token: string;
    try {
      token = decodeURIComponent(encodedToken);
    } catch {
      return new Response("Bad request", { status: 400, headers: mediaSecurityHeaders() });
    }
    if (!tokenPattern.test(token)) {
      return new Response("Not found", { status: 404, headers: mediaSecurityHeaders() });
    }

    this.pruneTokens();
    const entry = this.tokens.get(token);
    if (!entry) {
      return new Response("Not found", { status: 404, headers: mediaSecurityHeaders() });
    }
    if (Date.now() - entry.createdAt > mediaTokenTtlMs) {
      this.tokens.delete(token);
      return new Response("Not found", { status: 404, headers: mediaSecurityHeaders() });
    }

    const file = Bun.file(entry.filePath);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404, headers: mediaSecurityHeaders() });
    }

    const size = file.size;
    const commonHeaders = {
      ...mediaSecurityHeaders(),
      "accept-ranges": "bytes",
      "content-type": mediaTypeForPath(entry.filePath),
    };

    const rangeHeader = request.headers.get("range");
    if (!rangeHeader) {
      return new Response(request.method === "HEAD" ? null : file, {
        status: 200,
        headers: {
          ...commonHeaders,
          "content-length": String(size),
        },
      });
    }

    const parsedRange = parseByteRange(rangeHeader, size);
    if (!parsedRange) {
      return new Response("Requested Range Not Satisfiable", {
        status: 416,
        headers: {
          ...mediaSecurityHeaders(),
          "accept-ranges": "bytes",
          "content-range": `bytes */${size}`,
        },
      });
    }

    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    const chunk = file.slice(start, end + 1);

    return new Response(request.method === "HEAD" ? null : chunk, {
      status: 206,
      headers: {
        ...commonHeaders,
        "content-length": String(chunkSize),
        "content-range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  async resolveMediaSourceURL(filePath: string): Promise<string> {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      throw new Error("A media file path is required.");
    }

    const trimmedPath = filePath.trim();
    let pathInput = trimmedPath;
    const localPathFromFileURL = fileURLToLocalPath(trimmedPath);
    if (localPathFromFileURL) {
      pathInput = localPathFromFileURL;
    } else if (hasUrlScheme(trimmedPath) && !isWindowsDrivePath(trimmedPath)) {
      if (!canPassThroughMediaURL(trimmedPath)) {
        throw new Error("Unsupported media source URL scheme.");
      }
      return trimmedPath;
    }

    const normalizedPath = normalizeMediaPath(pathInput);
    const extension = path.extname(normalizedPath).toLowerCase();
    if (!mediaExtensions.has(extension)) {
      throw new Error("Unsupported media file format.");
    }

    const mediaFile = Bun.file(normalizedPath);
    if (!(await mediaFile.exists())) {
      throw new Error("Media file not found.");
    }

    await this.ensureServer();
    this.pruneTokens();

    const token = randomUUID();
    this.tokens.set(token, {
      filePath: normalizedPath,
      createdAt: Date.now(),
    });

    return `${this.origin}/media/${encodeURIComponent(token)}`;
  }

  stop(): void {
    this.server?.stop();
    this.server = null;
    this.origin = null;
    this.tokens.clear();
  }
}
