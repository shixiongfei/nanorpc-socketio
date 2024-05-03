/*
 * message.ts
 *
 * Copyright (c) 2024 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/nanorpc-socketio
 */

import { Socket } from "socket.io";

export class NanoRPCMessage {
  private readonly socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  once<P extends Array<unknown>>(
    event: string,
    listener: (...args: P) => void,
  ) {
    this.socket.once(`/message/${event}`, listener);
    return this;
  }

  on<P extends Array<unknown>>(event: string, listener: (...args: P) => void) {
    this.socket.on(`/message/${event}`, listener);

    return () => {
      this.socket.off(event, listener);
    };
  }

  send<P extends Array<unknown>>(event: string, ...args: P) {
    this.socket.emit(`/message/${event}`, ...args);
    return this;
  }
}
