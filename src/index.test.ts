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

const rpc = createNanoRPCServer("52440ec2-2a22-4544-93a7-161dfc47239a");

rpc.on("add", (a: number, b: number) => a + b);

rpc.run(4000);
