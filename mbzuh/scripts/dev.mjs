import { spawn } from "node:child_process";
import { createServer } from "vite";

const server = await createServer({ configFile: "vite.config.ts" });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? "http://localhost:5599/";
server.printUrls();

await new Promise((resolve, reject) => {
  const p = spawn("node", ["scripts/build-main.mjs"], { stdio: "inherit" });
  p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("main build failed"))));
});

const electronBin = (await import("electron")).default;
const child = spawn(electronBin, ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: url, NODE_ENV: "development" },
});
child.on("close", async () => {
  await server.close();
  process.exit(0);
});
