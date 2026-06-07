import { Effect } from "effect";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import { RpcClientDefect, RpcClientError } from "effect/unstable/rpc/RpcClientError";
import type { FromClientEncoded, FromServerEncoded } from "effect/unstable/rpc/RpcMessage";
import { Socket } from "effect/unstable/socket";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type EngineWireError = {
  readonly code: string;
  readonly message: string;
};

export type EngineWireClientMessage =
  | {
      readonly type: "request";
      readonly id: string;
      readonly method: string;
      readonly params: unknown;
      readonly authToken: string;
    }
  | {
      readonly type: "interrupt";
      readonly id: string;
      readonly authToken: string;
    }
  | {
      readonly type: "ping";
    };

export type EngineWireServerMessage =
  | {
      readonly type: "response";
      readonly id: string;
      readonly result: unknown;
    }
  | {
      readonly type: "error";
      readonly id: string;
      readonly error: EngineWireError;
    }
  | {
      readonly type: "chunk";
      readonly id: string;
      readonly values: readonly [unknown, ...unknown[]];
    }
  | {
      readonly type: "pong";
    }
  | {
      readonly type: "protocolError";
      readonly message: string;
    };

function protocolDefect(message: string, cause: unknown): RpcClientError {
  return new RpcClientError({ reason: new RpcClientDefect({ message, cause }) });
}

function encodeLine(value: EngineWireClientMessage): Uint8Array {
  return textEncoder.encode(`${JSON.stringify(value)}\n`);
}

function makeLineParser() {
  let buffer = "";
  return (chunk: Uint8Array | string): ReadonlyArray<EngineWireServerMessage> => {
    buffer += typeof chunk === "string" ? chunk : textDecoder.decode(chunk, { stream: true });
    const messages: EngineWireServerMessage[] = [];
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length === 0) continue;
      messages.push(JSON.parse(line) as EngineWireServerMessage);
    }
    return messages;
  };
}

export function toEngineWireClientMessage(
  request: FromClientEncoded,
  authToken: string,
): EngineWireClientMessage | undefined {
  switch (request._tag) {
    case "Request":
      return {
        type: "request",
        id: request.id,
        method: request.tag,
        params: request.payload,
        authToken,
      };
    case "Interrupt":
      return { type: "interrupt", id: request.requestId, authToken };
    case "Ping":
      return { type: "ping" };
    case "Ack":
    case "Eof":
      return undefined;
  }
}

export function fromEngineWireServerMessage(message: EngineWireServerMessage): FromServerEncoded {
  switch (message.type) {
    case "response":
      return {
        _tag: "Exit",
        requestId: message.id,
        exit: { _tag: "Success", value: message.result },
      };
    case "error":
      return {
        _tag: "Exit",
        requestId: message.id,
        exit: {
          _tag: "Failure",
          cause: [
            {
              _tag: "Fail",
              error: {
                _tag: "EngineRpcError",
                code: message.error.code,
                message: message.error.message,
              },
            },
          ],
        },
      };
    case "chunk":
      return { _tag: "Chunk", requestId: message.id, values: message.values };
    case "pong":
      return { _tag: "Pong" };
    case "protocolError":
      return {
        _tag: "ClientProtocolError",
        error: protocolDefect(message.message, undefined),
      };
  }
}

export function makeEngineWireRpcClientProtocol(options: {
  readonly authToken: string;
}) {
  return RpcClient.Protocol.make(
    Effect.fnUntraced(function* (writeResponse, clientIds) {
      const socket = yield* Socket.Socket;
      const writeRaw = yield* socket.writer;
      const parse = makeLineParser();
      const requestClientMap = new Map<string, number>();
      let currentError: RpcClientError | undefined;

      const broadcast = (response: FromServerEncoded) =>
        Effect.forEach(clientIds, (clientId) => writeResponse(clientId, response), { discard: true });

      yield* socket
        .runRaw((chunk) =>
          Effect.try({
            try: () => parse(chunk).map(fromEngineWireServerMessage),
            catch: (cause) => [
              {
                _tag: "ClientProtocolError" as const,
                error: protocolDefect("Error decoding engine wire message", cause),
              },
            ],
          }).pipe(
            Effect.flatMap((responses) =>
              Effect.forEach(
                responses,
                (response) => {
                  if (response._tag === "Pong") return Effect.void;
                  if ("requestId" in response) {
                    const clientId = requestClientMap.get(response.requestId);
                    if (clientId !== undefined) {
                      if (response._tag === "Exit") requestClientMap.delete(response.requestId);
                      return writeResponse(clientId, response);
                    }
                  }
                  return broadcast(response);
                },
                { discard: true },
              ),
            ),
          ),
        )
        .pipe(
          Effect.catch((cause: unknown) => {
            currentError = protocolDefect("Engine socket closed", cause);
            return broadcast({ _tag: "ClientProtocolError", error: currentError });
          }),
          Effect.forkScoped,
        );

      return {
        send(clientId, request) {
          if (currentError) return Effect.fail(currentError);
          if (request._tag === "Request") requestClientMap.set(request.id, clientId);
          if (request._tag === "Interrupt") requestClientMap.delete(request.requestId);
          const wireMessage = toEngineWireClientMessage(request, options.authToken);
          if (!wireMessage) return Effect.void;
          return writeRaw(encodeLine(wireMessage)).pipe(
            Effect.mapError((cause) => protocolDefect("Failed to write engine wire message", cause)),
          );
        },
        supportsAck: false,
        supportsTransferables: false,
      };
    }),
  );
}
