/*
 * index.test.ts
 *
 * Copyright (c) 2024 Xiongfei Shi
 *
 * Author: Xiongfei Shi <xiongfei.shi(a)icloud.com>
 * License: Apache-2.0
 *
 * https://github.com/shixiongfei/nanorpc-socketio
 */

import { createNanoRPCServer } from "./index.js";

const test = async () => {
  const rpc = createNanoRPCServer({
    onConnect: async (session) => {
      const timestamp: number | undefined = await rpc
        .client(session.id)
        ?.call("ping", Date.now());

      if (timestamp) {
        console.log(`Client ${session.id} RTT: ${Date.now() - timestamp} ms`);
      }

      return true;
    },
  });

  rpc.on("add", (a: number, b: number) => a + b);

  rpc.run(4000);
};

test();
