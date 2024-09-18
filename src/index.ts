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

import {
  NanoRPCError,
  NanoValidator,
  createNanoValidator,
} from "nanorpc-validator";
import { NanoMethods, createServer } from "./server.js";
import { NanoRPCClient } from "./client.js";

export * from "nanorpc-validator";

export enum NanoRPCStatus {
  OK = 0,
  Exception,
}

export enum NanoRPCErrCode {
  DuplicateMethod = -1,
  ProtocolError = -2,
  MissingMethod = -3,
  ParameterError = -4,
  CallError = -5,
}

export type NanoSession = Readonly<{
  id: string;
  ip: string;
  timestamp: number;
}>;

export type NanoServerOptions = Readonly<{
  secret?: string;
  queued?: boolean;
  timeout?: number;

  onConnect?: (
    session: NanoSession,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auth: { [key: string]: any },
  ) => Promise<boolean> | boolean;

  onDisconnect?: (session: NanoSession, reason: string) => void;
}>;

export type NanoMethodOptions = Readonly<{
  identity?: boolean;
}>;

export class NanoRPCServer {
  public readonly validators: NanoValidator;
  private readonly methods: NanoMethods;
  private readonly clients: { [id: string]: NanoRPCClient };
  private readonly server: ReturnType<typeof createServer>;

  constructor(options?: NanoServerOptions) {
    this.validators = createNanoValidator();
    this.methods = {};
    this.clients = {};
    this.server = createServer(
      this.validators,
      this.methods,
      this.clients,
      options,
    );
  }

  client(id: string) {
    return id in this.clients ? this.clients[id] : undefined;
  }

  on<T, P extends Array<unknown>>(
    method: string,
    func: (...args: P) => T | Promise<T>,
    options?: NanoMethodOptions,
  ) {
    if (method in this.methods) {
      throw new NanoRPCError(
        NanoRPCErrCode.DuplicateMethod,
        `${method} method already registered`,
      );
    }

    this.methods[method] = (id, rpc) => {
      const params = Array.isArray(rpc.params)
        ? rpc.params
        : rpc.params
          ? [rpc.params]
          : [];
      const args = (options?.identity ? [id, ...params] : params) as P;

      return func(...args);
    };

    return this;
  }

  publish<P extends Array<unknown>>(channels: string | string[], ...args: P) {
    if (Array.isArray(channels)) {
      if (channels.length > 0) {
        this.server.to(channels).emit("/publish", channels, ...args);
      }
    } else {
      this.server.to(channels).emit("/publish", [channels], ...args);
    }

    return this;
  }

  broadcast<P extends Array<unknown>>(event: string, ...args: P) {
    this.server.emit(`/message/${event}`, ...args);
    return this;
  }

  run(port: number, listener?: () => void) {
    this.server.listen(port);

    if (listener) {
      listener();
    }

    return () => {
      this.server.close();
    };
  }
}

export const createNanoRPCServer = (options?: NanoServerOptions) =>
  new NanoRPCServer(options);
