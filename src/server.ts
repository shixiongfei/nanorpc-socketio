/*
 * server.ts
 *
 * Copyright (c) 2024 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/nanorpc-socketio
 */

import { isPromise } from "node:util/types";
import { Mutex } from "async-mutex";
import { Server } from "socket.io";
import { createParser } from "safety-socketio";
import { NanoRPC, NanoValidator, createNanoReply } from "nanorpc-validator";
import { NanoServerOptions, NanoSession } from "./index.js";
import { NanoRPCClient } from "./client.js";

export enum NanoRPCCode {
  OK = 0,
  ProtocolError,
  MissingMethod,
  ParameterError,
  Exception,
}

export type NanoMethods = {
  [method: string]: (
    id: string,
    rpc: NanoRPC<string, unknown[]>,
  ) => unknown | Promise<unknown>;
};

export const createServer = (
  validators: NanoValidator,
  methods: NanoMethods,
  clients: { [id: string]: NanoRPCClient },
  options?: NanoServerOptions,
) => {
  const mutex = options?.queued ? new Mutex() : undefined;

  const io = new Server({
    parser: options?.secret ? createParser(options.secret) : undefined,
    transports: ["websocket"],
    cors: { origin: "*" },
  });

  io.on("connection", async (socket) => {
    const session: NanoSession = Object.freeze({
      id: socket.id,
      ip:
        "x-forwarded-for" in socket.handshake.headers
          ? (socket.handshake.headers["x-forwarded-for"] as string)
              .split(",")[0]
              .trim()
          : socket.handshake.address,
      timestamp: Date.now(),
    });

    socket.on("disconnect", (reason) => {
      if (options?.onDisconnect) {
        options.onDisconnect(session, reason);
      }

      if (session.id in clients) {
        delete clients[session.id];
      }
    });

    socket.on("/subscribe", (channels: string | string[], resp) => {
      if (!Array.isArray(channels)) {
        channels = [channels];
      }

      channels = channels.filter((channel) => typeof channel === "string");

      if (channels.length > 0) {
        socket.join(channels);
      }

      if (typeof resp === "function") {
        resp(channels);
      }
    });

    socket.on("/unsubscribe", (channels: string | string[], resp) => {
      if (!Array.isArray(channels)) {
        channels = [channels];
      }

      channels = channels.filter((channel) => typeof channel === "string");

      channels.forEach((channel) => {
        socket.leave(channel);
      });

      if (typeof resp === "function") {
        resp(channels);
      }
    });

    socket.on("/nanorpcs", async (rpc: NanoRPC<string, unknown[]>, resp) => {
      if (typeof resp !== "function") {
        return;
      }

      if (!rpc || !("method" in rpc) || typeof rpc.method !== "string") {
        const reply = createNanoReply(
          rpc?.id ?? "",
          NanoRPCCode.ProtocolError,
          "Protocol Error",
        );
        return resp(reply);
      }

      const func = methods[rpc.method];

      if (!func) {
        const reply = createNanoReply(
          rpc?.id ?? "",
          NanoRPCCode.MissingMethod,
          "Missing Method",
        );
        return resp(reply);
      }

      const validator = validators.getValidator(rpc.method);

      if (validator && !validator(rpc)) {
        const lines = validator.errors!.map(
          (err) => `${err.keyword}: ${err.instancePath}, ${err.message}`,
        );
        const reply = createNanoReply(
          (rpc as { id?: string })?.id ?? "",
          NanoRPCCode.ParameterError,
          lines.join("\n"),
        );
        return resp(reply);
      }

      const doFunc = async () => {
        const result = func(socket.id, rpc);
        return isPromise(result) ? await result : result;
      };

      try {
        const retval = mutex
          ? await mutex.runExclusive(doFunc)
          : await doFunc();

        const reply = createNanoReply(rpc.id, 0, "OK", retval);
        return resp(reply);
      } catch (error) {
        const message =
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : `${error}`;
        const reply = createNanoReply(
          rpc?.id ?? "",
          NanoRPCCode.Exception,
          message,
        );
        return resp(reply);
      }
    });

    clients[session.id] = new NanoRPCClient(session, socket, options?.timeout);

    if (options?.onConnect) {
      const connecting = options.onConnect(session, socket.handshake.auth);
      const allowed = isPromise(connecting) ? await connecting : connecting;

      if (!allowed) {
        return socket.disconnect();
      }
    }
  });

  return io;
};
