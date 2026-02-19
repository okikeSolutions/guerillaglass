type RpcRequestSchema = Record<string, { params: unknown; response: unknown }>;
type RpcMessageSchema = Record<string, unknown>;

type RpcRequestClient<TRequests extends RpcRequestSchema> = {
  [K in keyof TRequests]: (params?: TRequests[K]["params"]) => Promise<TRequests[K]["response"]>;
};

type RpcMessageClient<TMessages extends RpcMessageSchema> = {
  [K in keyof TMessages]: (payload: TMessages[K]) => void;
};

export type RPCSchema<
  T extends {
    requests: RpcRequestSchema;
    messages: RpcMessageSchema;
  },
> = T;

export type ApplicationMenuItemConfig =
  | {
      type: "divider" | "separator";
    }
  | {
      type?: "normal";
      label?: string;
      action?: string;
      role?: string;
      accelerator?: string;
      enabled?: boolean;
      submenu?: ApplicationMenuItemConfig[];
    };

export type MenuItemConfig =
  | {
      type: "divider" | "separator";
    }
  | {
      type?: "normal";
      label?: string;
      action?: string;
      role?: string;
      enabled?: boolean;
      submenu?: MenuItemConfig[];
    };

export const BrowserView: {
  defineRPC<T>(_config: { handlers: unknown }): T;
};

export class BrowserWindow<TRPC = unknown> {
  constructor(options: {
    title?: string;
    url: string;
    rpc?: TRPC;
    frame?: {
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    };
  });

  readonly webview: {
    readonly rpc?: {
      readonly request: RpcRequestClient<RpcRequestSchema>;
      readonly send: RpcMessageClient<RpcMessageSchema>;
    };
    toggleDevTools(): void;
  };

  on(event: "close" | "focus", handler: () => void | Promise<void>): void;
}

export class Tray {
  constructor(options: { title?: string });
  on(event: "tray-clicked", handler: (event: unknown) => void): void;
  setMenu(menu: MenuItemConfig[]): void;
  remove(): void;
}

export const ApplicationMenu: {
  setApplicationMenu(menu: ApplicationMenuItemConfig[]): void;
};

export const Updater: {
  localInfo: {
    channel(): Promise<string>;
  };
};

export const Utils: {
  readonly paths: {
    readonly documents: string;
  };
  openFileDialog(options: {
    startingFolder?: string;
    canChooseFiles?: boolean;
    canChooseDirectory?: boolean;
    allowsMultipleSelection?: boolean;
    allowedFileTypes?: string | string[];
  }): Promise<string[]>;
  openExternal(url: string): Promise<void>;
  quit(): void;
};

declare const Electrobun: {
  readonly events: {
    on(event: string, handler: (event: unknown) => void): void;
  };
};

export default Electrobun;
