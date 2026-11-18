import assert from "node:assert/strict";
import {mkdtemp, readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {createRenderServer} from "../render-server.mjs";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "dolphin-render-test-"));
const snapshotPath = join(temporaryDirectory, "snapshot.json");
const server = createRenderServer({snapshotPath, collectorToken: "test-secret"});

await new Promise((resolveListen, rejectListen) => {
  server.once("error", rejectListen);
  server.listen(0, "127.0.0.1", resolveListen);
});

try {
  const {port} = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/health`)).json(), {ok: true, storage: true});

  const payload = {version: 1, experiments: [], gpus: [], counts: {}};
  const denied = await fetch(`${baseUrl}/api/ingest`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 401);

  const accepted = await fetch(`${baseUrl}/api/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-secret",
    },
    body: JSON.stringify(payload),
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).ok, true);

  const current = await (await fetch(`${baseUrl}/api/snapshot`)).json();
  assert.ok(current.received_at);
  assert.equal(JSON.parse(await readFile(snapshotPath, "utf8")).received_at, current.received_at);
} finally {
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => error ? rejectClose(error) : resolveClose());
  });
}

console.log("Render HTTP adapter, authorization, and snapshot persistence passed");

