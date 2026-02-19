type RpcRequestSchema = Record<string, { params: unknown; response: unknown }>;
type RpcMessageSchema = Record<string, unknown>;

type RpcRequestClient<TRequests extends RpcRequestSchema> = {
  [K in keyof TRequests]: (params?: TRequests[K]["params"]) => Promise<TRequests[K]["response"]>;
};

type RpcMessageClient<TMessages extends RpcMessageSchema> = {
  [K in keyof TMessages]: (payload: TMessages[K]) => void;
};

type RpcChannelSchema = {
  requests: RpcRequestSchema;
  messages: RpcMessageSchema;
};

export class Electroview<TRPC = unknown> {
  constructor(options?: { rpc?: TRPC });

  static defineRPC<T extends { bun: RpcChannelSchema }>(_config: {
    handlers: unknown;
  }): {
    readonly request: RpcRequestClient<T["bun"]["requests"]>;
    readonly send: RpcMessageClient<T["bun"]["messages"]>;
  };
}
