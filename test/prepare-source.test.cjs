const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepare } = require("../scripts/prepare-source.cjs");

test("only target the release repository and retain independent app data", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "collectify-public-build-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["config", "plugins", "scripts"])
    fs.mkdirSync(path.join(root, dir));
  const config = {
    distribution: { clientId: "public-client-id" },
    initialData: { version: 2 },
  };
  fs.writeFileSync(
    path.join(root, "config/app-defaults.json"),
    JSON.stringify(config),
  );
  fs.writeFileSync(
    path.join(root, "plugins/definitions.json"),
    JSON.stringify({ repository: "old/repo", plugins: [] }),
  );
  fs.writeFileSync(
    path.join(root, "scripts/build-plugin-catalog.cjs"),
    "exports.buildCatalog = () => {};",
  );
  assert.throws(() => prepare(root, "untrusted/repo"));
  prepare(root, "sunycoder/Collectify-releases");
  const next = JSON.parse(
    fs.readFileSync(path.join(root, "config/app-defaults.json"), "utf8"),
  );
  assert.equal(next.distribution.project, "sunycoder/Collectify-releases");
  assert.equal(next.distribution.clientId, config.distribution.clientId);
  assert.deepEqual(next.initialData, config.initialData);
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(root, "plugins/definitions.json"), "utf8"),
    ).repository,
    next.distribution.project,
  );
});
