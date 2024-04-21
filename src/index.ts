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

export type NanoSession = Readonly<{
  id: string;
  ip: string;
  timestamp: number;
}>;

export type NanoServerOptions = Readonly<{
  queued?: boolean;
  onConnect?: <T>(session: NanoSession, auth: T) => Promise<boolean> | boolean;
  onDisconnect?: (session: NanoSession, reason: string) => void;
}>;

export type NanoMethodOptions = Readonly<{
  identity?: boolean;
}>;

export class NanoRPCServer {
  public readonly validators: NanoValidator;
  private readonly methods: NanoMethods;
  private readonly server: ReturnType<typeof createServer>;

  constructor(secret: string, options?: NanoServerOptions) {
    this.validators = createNanoValidator();
    this.methods = {};
    this.server = createServer(secret, this.validators, this.methods, options);
  }

  on<T, M extends string, P extends Array<unknown>>(
    method: M,
    func: (...args: P) => T | Promise<T>,
    options?: NanoMethodOptions,
  ) {
    if (method in this.methods) {
      throw new Error(`${method} method already registered`);
    }

    this.methods[method] = (id, rpc) => {
      const args = options?.identity
        ? ([id, ...rpc.arguments] as P)
        : (rpc.arguments as P);
      return func(...args);
    };

    return this;
  }

  run(port: number, listener?: () => void) {
    this.server.listen(port, listener);

    return () => {
      this.server.close();
    };
  }
}

export const createNanoRPCServer = (
  secret: string,
  options?: NanoServerOptions,
) => new NanoRPCServer(secret, options);
