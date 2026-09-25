// Runs the Android Gradle wrapper on any OS: `node scripts/gradle.mjs assembleRelease`.
// (`./gradlew` doesn't work from npm scripts on Windows, where npm uses cmd.exe — and cmd
// may not look in the current folder at all, so the wrapper is called by its full path.)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const cwd = fileURLToPath(new URL("../android/", import.meta.url));
const win = process.platform === "win32";
const wrapper = join(cwd, win ? "gradlew.bat" : "gradlew");
const r = spawnSync(win ? `"${wrapper}"` : wrapper, process.argv.slice(2), { cwd, stdio: "inherit", shell: win });
process.exit(r.status ?? 1);
