/*
 * client.ts
 *
 * Copyright (c) 2024 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/nanorpc-socketio
 */

import { Socket } from "socket.io";
import {
  NanoReply,
  NanoValidator,
  createNanoRPC,
  createNanoValidator,
} from "nanorpc-validator";
import { NanoSession } from "./index.js";
import { NanoRPCCode } from "./server.js";
import { NanoRPCMessage } from "./message.js";

export class NanoRPCClient {
  public readonly validators: NanoValidator;
  public readonly message: NanoRPCMessage;
  public readonly session: NanoSession;
  private readonly timeout: number;
  private readonly socket: Socket;

  constructor(session: NanoSession, socket: Socket, timeout?: number) {
    this.validators = createNanoValidator();
    this.message = new NanoRPCMessage(socket);
    this.session = session;
    this.timeout = timeout ?? 0;
    this.socket = socket;
  }

  get id() {
    return this.socket.id;
  }

  get connected() {
    return this.socket.connected;
  }

  get disconnected() {
    return this.socket.disconnected;
  }

  close() {
    this.socket.disconnect();
    return this;
  }

  apply<T, M extends string, P extends Array<unknown>>(method: M, args: P) {
    const rpc = createNanoRPC(method, args);

    const parseReply = (reply: NanoReply<T>) => {
      const validator = this.validators.getValidator(method);

      if (validator && !validator(reply)) {
        const lines = validator.errors!.map(
          (err) => `${err.keyword}: ${err.instancePath}, ${err.message}`,
        );
        const error = lines.join("\n");

        throw new Error(`NanoRPC call ${method}, ${error}`);
      }

      if (reply.code !== NanoRPCCode.OK) {
        throw new Error(`NanoRPC call ${method} ${reply.message}`);
      }

      return reply.value;
    };

    return new Promise<T | undefined>((resolve, reject) => {
      if (this.timeout > 0) {
        this.socket
          .timeout(this.timeout)
          .emit(
            `/nanorpcs/${method}`,
            rpc,
            (error: Error, reply: NanoReply<T>) => {
              if (error) {
                reject(error);
              } else {
                try {
                  resolve(parseReply(reply));
                } catch (error) {
                  reject(error);
                }
              }
            },
          );
      } else {
        this.socket.emit(`/nanorpcs/${method}`, rpc, (reply: NanoReply<T>) => {
          try {
            resolve(parseReply(reply));
          } catch (error) {
            reject(error);
          }
        });
      }
    });
  }

  async call<T, M extends string, P extends Array<unknown>>(
    method: M,
    ...args: P
  ) {
    return this.apply<T, M, P>(method, args);
  }

  invoke<T, M extends string, P extends Array<unknown>>(method: M) {
    return async (...args: P) => await this.apply<T, M, P>(method, args);
  }
}
