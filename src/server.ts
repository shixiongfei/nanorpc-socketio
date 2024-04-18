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
import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createParser } from "safety-socketio";
import { NanoRPC, NanoValidator } from "nanorpc-validator";
import { NanoServerOptions, NanoSession } from "./index.js";

export type NanoMethods = {
  [method: string]: (
    rpc: NanoRPC<string, unknown[]>,
  ) => unknown | Promise<unknown>;
};

export const createServer = (
  secret: string,
  validators: NanoValidator,
  methods: NanoMethods,
  options?: NanoServerOptions,
) => {
  const app = express();

  app.set("trust proxy", true);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const server = http.createServer(app);

  const io = new Server(server, {
    parser: createParser(secret),
    transports: ["websocket"],
  });

  io.on("connection", async (socket) => {
    const session: NanoSession = {
      id: socket.id,
      ip:
        "x-forwarded-for" in socket.handshake.headers
          ? (socket.handshake.headers["x-forwarded-for"] as string)
              .split(",")[0]
              .trim()
          : socket.handshake.address,
      timestamp: Date.now(),
    };

    if (options?.onConnect) {
      const connecting = options.onConnect(session, socket.handshake.auth);
      const allowed = isPromise(connecting) ? await connecting : connecting;

      if (!allowed) {
        return socket.disconnect();
      }
    }

    socket.on("error", (error) => {
      if (options?.onDisconnect) {
        options.onDisconnect(session, error.message);
      }
      return socket.disconnect();
    });

    socket.on("disconnect", (reason) => {
      if (options?.onDisconnect) {
        options.onDisconnect(session, reason);
      }
    });
  });

  return server;
};
