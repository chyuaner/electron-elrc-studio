const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Helper to get git info
function getGitVersion() {
  let baseVersion = "0.0.0";

  // 1. Try to get the latest tag reachable from the current commit
  try {
    const latestTag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (latestTag) {
      baseVersion = latestTag.startsWith("v") ? latestTag.slice(1) : latestTag;
    }
  } catch (e) {
    // No tags found in history, keep baseVersion as "0.0.0"
  }

  // 2. Check if we are on an exact tag match
  try {
    const exactTag = execSync("git describe --tags --exact-match", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (exactTag) {
      return exactTag.startsWith("v") ? exactTag.slice(1) : exactTag;
    }
  } catch (e) {
    // Not on an exact tag
  }

  // 3. Fallback to baseVersion-dev.commitId
  try {
    const commitId = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    return `${baseVersion}-dev.${commitId}`;
  } catch (e) {
    return `${baseVersion}-dev`;
  }
}

const args = process.argv.slice(2);

// Check if version is already provided in arguments
const hasVersionArg = args.some(
  (arg) =>
    arg.startsWith("--config.extraMetadata.version=") ||
    arg.startsWith("-c.extraMetadata.version=")
);

const finalArgs = [...args];
if (!hasVersionArg) {
  const version = getGitVersion();
  console.log(`[build.js] Automatically determined version: ${version}`);
  finalArgs.push(`--config.extraMetadata.version=${version}`);
} else {
  console.log(`[build.js] Using provided version from arguments.`);
}

// Find electron-builder path
function getBuilderExecutable() {
  const localBin = path.join(__dirname, "..", "node_modules", ".bin");
  const winExt = process.platform === "win32" ? ".cmd" : "";
  const localPath = path.join(localBin, `electron-builder${winExt}`);
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";
}

const cmd = getBuilderExecutable();
console.log(`[build.js] Executing: ${cmd} ${finalArgs.join(" ")}`);

const isWin = process.platform === "win32";
const child = spawn(cmd, finalArgs, {
  stdio: "inherit",
  shell: isWin
});

child.on("close", (code) => {
  process.exit(code);
});
