/*
 * index.ts
 *
 * Copyright (c) 2024 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/nanorpc-socketio
 */

import { NanoValidator, createNanoValidator } from "nanorpc-validator";
import { NanoMethods, createServer } from "./server.js";

export type NanoServerOptions = {
  secret?: string;
  queued?: boolean;
  onConnect?: <T>(auth: T) => Promise<string | undefined> | string | undefined;
  onDisconnect?: (id: string) => void;
};

export class NanoRPCServer {
  public readonly validators: NanoValidator;
  private readonly methods: NanoMethods;
  private readonly server: ReturnType<typeof createServer>;

  constructor(options: NanoServerOptions) {
    this.validators = createNanoValidator();
    this.methods = {};
    this.server = createServer(
      options.secret ?? "",
      this.validators,
      this.methods,
      options.queued ?? false,
      options.onConnect,
      options.onDisconnect,
    );
  }

  on<T, M extends string, P extends Array<unknown>>(
    method: M,
    func: (...args: P) => T | Promise<T>,
  ) {
    if (method in this.methods) {
      throw new Error(`${method} method already registered`);
    }

    this.methods[method] = (rpc) => func(...(rpc.arguments as P));

    return this;
  }

  run(port: number, listener?: () => void) {
    this.server.listen(port, listener);

    return () => {
      this.server.close();
    };
  }
}

export const createNanoRPCServer = (options: NanoServerOptions) =>
  new NanoRPCServer(options);
