import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createParser } from "safety-socketio";
import { NanoRPC, NanoValidator } from "nanorpc-validator";

export type NanoMethods = {
  [method: string]: (
    rpc: NanoRPC<string, unknown[]>,
  ) => unknown | Promise<unknown>;
};

export const createServer = (
  secret: string,
  validators: NanoValidator,
  methods: NanoMethods,
  queued: boolean,
  onConnect?: <T>(auth: T) => Promise<string | undefined> | string | undefined,
  onDisconnect?: (id: string) => void,
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

  return server;
};
