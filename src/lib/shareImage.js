// ═══════════════════════════════════════════════════════════════════════════════
//  SHARE IMAGE — hands a canvas (invite, payment card) to the share sheet.
//  Android can only share files, not data URLs: the PNG goes into the app's
//  cache dir (FileProvider cache-path, res/xml/file_paths.xml) and Share passes
//  it on. In a browser: the Web Share API with files, else a plain download.
//  A .jpg name saves a JPEG (the invite: soft gradients, a much smaller file to
//  pass across the bridge); anything else a PNG (the payment card: crisp QRs).
//  Returns "shared" | "cancelled" | "downloaded"; real failures throw.
// ═══════════════════════════════════════════════════════════════════════════════
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "./http.js";

const isCancel = (e) => e?.name === "AbortError" || /cancel/i.test(String(e?.message || e));

export async function shareImage(canvas, fileName, title, text) {
  const type = /\.jpe?g$/i.test(fileName) ? "image/jpeg" : "image/png";
  if (isNative()) {
    const data = canvas.toDataURL(type, 0.92).split(",")[1];
    const { uri } = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    try {
      await Share.share({ title, text, files: [uri], dialogTitle: title });
      return "shared";
    } catch (e) {
      if (isCancel(e)) return "cancelled";
      throw e;
    }
  }

  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the image"))), type, 0.92));
  const file = typeof File === "function" ? new File([blob], fileName, { type }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, text, files: [file] });
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
