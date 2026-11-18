import http from "node:http";
import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";
import {fileURLToPath, pathToFileURL} from "node:url";

import worker from "./dist/server/index.js";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));

export function createFileBucket(snapshotPath) {
  let cached = null;
  let loaded = false;

  return {
    async get(key) {
      if (key !== "snapshot.json") return null;
      if (!loaded) {
        loaded = true;
        try {
          cached = await readFile(snapshotPath, "utf8");
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      return cached === null ? null : {json: async () => JSON.parse(cached)};
    },

    async put(key, value) {
      if (key !== "snapshot.json") throw new Error(`Unsupported object key: ${key}`);
      await mkdir(dirname(snapshotPath), {recursive: true});
      const temporaryPath = `${snapshotPath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temporaryPath, value, {encoding: "utf8", mode: 0o600});
      await rename(temporaryPath, snapshotPath);
      cached = value;
      loaded = true;
    },
  };
}

export function createRenderServer(options = {}) {
  const snapshotPath = options.snapshotPath
    ?? process.env.SNAPSHOT_PATH
    ?? "/tmp/dolphin-monitor/snapshot.json";
  const env = {
    BUCKET: options.bucket ?? createFileBucket(snapshotPath),
    COLLECTOR_TOKEN: options.collectorToken ?? process.env.COLLECTOR_TOKEN,
    TENSORBOARD_COLLECTOR_TOKEN:
      options.tensorboardCollectorToken ?? process.env.TENSORBOARD_COLLECTOR_TOKEN,
  };

  return http.createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? "localhost";
      const protocol = request.headers["x-forwarded-proto"] ?? "http";
      const init = {
        method: request.method,
        headers: request.headers,
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = Readable.toWeb(request);
        init.duplex = "half";
      }

      const result = await worker.fetch(
        new Request(`${protocol}://${host}${request.url}`, init),
        env,
        {},
      );
      response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
      if (request.method === "HEAD" || !result.body) {
        response.end();
        return;
      }
      await pipeline(Readable.fromWeb(result.body), response);
    } catch (error) {
      console.error("Request failed", error);
      if (!response.headersSent) {
        response.writeHead(500, {"content-type": "application/json; charset=utf-8"});
      }
      response.end(JSON.stringify({error: "internal server error"}));
    }
  });
}

export async function startRenderServer() {
  const port = Number(process.env.PORT || 10000);
  const server = createRenderServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "0.0.0.0", resolveListen);
  });
  console.log(`Dolphin monitor listening on 0.0.0.0:${port}`);
  return server;
}

const isEntrypoint = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntrypoint) {
  await startRenderServer();
}

