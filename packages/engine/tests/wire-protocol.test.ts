import { describe, expect, test } from "bun:test";
import { fromEngineWireServerMessage, toEngineWireClientMessage } from "../src/client/wireProtocol";

describe("stable Guerillaglass wire protocol bridge", () => {
  test("TS encodes Effect request to stable native request", () => {
    const message = toEngineWireClientMessage(
      {
        _tag: "Request",
        id: "1",
        tag: "engine.capabilities",
        payload: {},
        headers: [],
      },
      "token-1",
    );

    expect(message).toEqual({
      type: "request",
      id: "1",
      method: "engine.capabilities",
      params: {},
      authToken: "token-1",
    });
  });

  test("native stable success decodes to Effect Exit success", () => {
    expect(
      fromEngineWireServerMessage({
        type: "response",
        id: "2",
        result: { protocolVersion: "2" },
      }),
    ).toEqual({
      _tag: "Exit",
      requestId: "2",
      exit: { _tag: "Success", value: { protocolVersion: "2" } },
    });
  });

  test("stream chunk shape decodes to Effect Chunk", () => {
    expect(
      fromEngineWireServerMessage({
        type: "chunk",
        id: "stream-1",
        values: [{ isRunning: true }],
      }),
    ).toEqual({
      _tag: "Chunk",
      requestId: "stream-1",
      values: [{ isRunning: true }],
    });
  });

  test("interrupt encodes to stable native interrupt", () => {
    expect(
      toEngineWireClientMessage({ _tag: "Interrupt", requestId: "stream-1" }, "token-1"),
    ).toEqual({ type: "interrupt", id: "stream-1", authToken: "token-1" });
  });

  test("native auth failure decodes to typed Effect failure", () => {
    expect(
      fromEngineWireServerMessage({
        type: "error",
        id: "unknown",
        error: {
          code: "permission_denied",
          message: "Missing or invalid engine socket auth token",
        },
      }),
    ).toEqual({
      _tag: "Exit",
      requestId: "unknown",
      exit: {
        _tag: "Failure",
        cause: [
          {
            _tag: "Fail",
            error: {
              _tag: "EngineRpcError",
              code: "permission_denied",
              message: "Missing or invalid engine socket auth token",
            },
          },
        ],
      },
    });
  });
});
