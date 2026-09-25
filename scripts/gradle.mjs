// Runs the Android Gradle wrapper on any OS: `node scripts/gradle.mjs assembleRelease`.
// (`./gradlew` doesn't work from npm scripts on Windows, where npm uses cmd.exe.)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../android/", import.meta.url));
const win = process.platform === "win32";
const r = spawnSync(win ? "gradlew.bat" : "./gradlew", process.argv.slice(2), { cwd, stdio: "inherit", shell: win });
process.exit(r.status ?? 1);
