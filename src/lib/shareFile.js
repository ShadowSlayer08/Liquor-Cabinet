// ═══════════════════════════════════════════════════════════════════════════════
//  SHARE FILE — hands a small text file (a co-host plan, .lcplan.json) to the
//  share sheet, the way lib/shareImage.js does for pictures (v1.6).
//  Android can only share files, not text blobs: it goes into the app's cache dir
//  (FileProvider cache-path, res/xml/file_paths.xml) and Share passes it on; iOS
//  shares the same file URL. In a browser: the Web Share API with files when it
//  takes this type (Chrome doesn't for JSON), else a plain download.
//  Returns "shared" | "cancelled" | "downloaded"; real failures throw.
// ═══════════════════════════════════════════════════════════════════════════════
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "./http.js";

const isCancel = (e) => e?.name === "AbortError" || /cancel/i.test(String(e?.message || e));

export async function shareFile(text, fileName, title, message, type = "application/json") {
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title, text: message, files: [uri], dialogTitle: title });
      return "shared";
    } catch (e) {
      if (isCancel(e)) return "cancelled";
      throw e;
    }
  }

  const blob = new Blob([text], { type });
  const file = typeof File === "function" ? new File([blob], fileName, { type }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, text: message, files: [file] });
      return "shared";
    } catch (e) {
      if (isCancel(e)) return "cancelled";
      // e.g. NotAllowedError when the tap is too long ago — fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
