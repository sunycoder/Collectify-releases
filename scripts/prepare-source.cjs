const fs = require("node:fs");
const path = require("node:path");

// 仅修改临时构建目录中的公开下载目标，不改动源码仓库或团队私有配置。
function prepare(root, repository) {
  if (repository !== "sunycoder/Collectify-releases")
    throw Error("Unexpected release repository");
  const configFile = path.join(root, "config/app-defaults.json");
  const definitionFile = path.join(root, "plugins/definitions.json");
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  const definition = JSON.parse(fs.readFileSync(definitionFile, "utf8"));
  config.distribution = {
    ...config.distribution,
    provider: "github",
    baseUrl: "https://github.com",
    project: repository,
    ref: "main",
  };
  definition.repository = repository;
  delete definition.publisher;
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n", "utf8");
  fs.writeFileSync(
    definitionFile,
    JSON.stringify(definition, null, 2) + "\n",
    "utf8",
  );
  require(path.join(root, "scripts/build-plugin-catalog.cjs")).buildCatalog({
    root,
  });
}

if (require.main === module)
  prepare(
    path.resolve(process.argv[2] || "source"),
    process.env.GITHUB_REPOSITORY,
  );
module.exports = { prepare };
