const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function api(endpoint, body, method = "POST") {
  const args = ["api", endpoint];
  if (body !== undefined) args.push("--method", method, "--input", "-");
  return JSON.parse(
    execFileSync("gh", args, {
      encoding: "utf8",
      input: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function publish() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo !== "sunycoder/Collectify-releases")
    throw Error("Unexpected release repository");
  const prefix = `repos/${repo}`;
  const catalog = JSON.parse(
    fs.readFileSync("source/.plugin-release/catalog.json", "utf8"),
  );
  // 目录最后发布：所有公开附件可用后，用户才会看到新下载地址。
  for (const plugin of catalog.plugins) {
    const url = new URL(plugin.url);
    if (
      url.origin !== "https://github.com" ||
      !url.pathname.startsWith(`/${repo}/releases/download/`)
    )
      throw Error("Plugin asset is outside the public release repository");
    const response = await fetch(plugin.url, {
      headers: { Range: "bytes=0-3" },
    });
    await response.body?.cancel();
    if (![200, 206].includes(response.status))
      throw Error(`Plugin download unavailable: ${plugin.id}`);
  }
  const files = [
    {
      path: "plugins/catalog.json",
      content: JSON.stringify(catalog, null, 2) + "\n",
    },
  ];
  if (process.env.RELEASE_MODE === "release") {
    const version = JSON.parse(
      fs.readFileSync("source/package.json", "utf8"),
    ).version;
    const release = api(`${prefix}/releases/tags/v${version}`);
    if (release.draft) throw Error("App release is not public");
    const installers = release.assets.filter((asset) =>
      /^Collectify-.*\.(exe|dmg|deb|AppImage)$/.test(asset.name),
    );
    if (installers.length !== 5)
      throw Error("Expected five platform installers");
    files.push({
      path: "README.md",
      content:
        `# Collectify\n\n可扩展的个人插件工作台，支持 Windows、macOS 和 Linux。\n\n当前版本：**${version}**\n\n` +
        installers
          .map((asset) => `- [${asset.name}](${asset.browser_download_url})`)
          .join("\n") +
        `\n\n[全部版本与发布说明](https://github.com/${repo}/releases)\n\n在“设置 → 插件 → 发现插件”中安装和更新插件。\n\n安装包暂未签名，macOS 未公证。\n`,
    });
  }
  const head = api(`${prefix}/git/ref/heads/main`).object.sha;
  const parent = api(`${prefix}/git/commits/${head}`);
  // 固定白名单，禁止将源码目录或构建目录加入公开 Git 历史。
  const tree = api(`${prefix}/git/trees`, {
    base_tree: parent.tree.sha,
    tree: files.map((file) => ({ ...file, mode: "100644", type: "blob" })),
  });
  if (tree.sha === parent.tree.sha) return;
  const commit = api(`${prefix}/git/commits`, {
    message: "chore: 更新公开下载目录",
    tree: tree.sha,
    parents: [head],
  });
  api(
    `${prefix}/git/refs/heads/main`,
    { sha: commit.sha, force: false },
    "PATCH",
  );
}

if (require.main === module)
  publish().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
