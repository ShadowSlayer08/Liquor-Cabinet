import Foundation
import UIKit
import WebKit
import Capacitor

/**
 * Reads data off a web page that only answers a real browser — the iOS side of WebRenderPlugin.java,
 * same JS contract (src/lib/blinkitLive.js):
 *   extract({ url, script, timeoutMs, pollMs, lat?, lon? }) → { result: string | null, timedOut, url }
 * Loads `url` in a WKWebView hidden underneath the app's own (opaque) web view — it has to stay in
 * the window, as WebKit suspends the timers of detached views — with the user's own connection,
 * then runs `script` every `pollMs` until it returns something non-empty.
 * iOS would ask "blinkit.com would like to use your location" from a page nobody can see, so when
 * the app already knows where you are (lat/lon), the page's navigator.geolocation answers with that
 * instead. One page at a time; the web view is always torn down afterwards.
 */
@objc(WebRenderPlugin)
public class WebRenderPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate, WKUIDelegate {
    public let identifier = "WebRenderPlugin"
    public let jsName = "WebRender"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "extract", returnType: CAPPluginReturnPromise)
    ]

    /// One page being read. Only touched on the main thread.
    private final class Job {
        let call: CAPPluginCall
        let web: WKWebView
        let script: String
        var done = false
        var poll: Timer?
        var timeout: Timer?

        init(call: CAPPluginCall, web: WKWebView, script: String) {
            self.call = call
            self.web = web
            self.script = script
        }
    }

    private var job: Job?

    @objc func extract(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let script = call.getString("script"), !script.isEmpty else {
            call.reject("An http(s) url and a script are required")
            return
        }
        let timeoutMs = max(1000, call.getInt("timeoutMs", 20000))
        let pollMs = max(200, call.getInt("pollMs", 700))
        let lat = call.getDouble("lat")
        let lon = call.getDouble("lon")
        DispatchQueue.main.async {
            self.start(call, url: url, script: script, timeoutMs: timeoutMs, pollMs: pollMs, lat: lat, lon: lon)
        }
    }

    private func start(_ call: CAPPluginCall, url: URL, script: String, timeoutMs: Int, pollMs: Int, lat: Double?, lon: Double?) {
        if job != nil {
            call.reject("Already reading a page — try again in a moment", "BUSY")
            return
        }
        guard let host = bridge?.viewController?.view else {
            call.reject("The app isn't on screen")
            return
        }

        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.mediaTypesRequiringUserActionForPlayback = .all
        if let lat = lat, let lon = lon {
            config.userContentController.addUserScript(
                WKUserScript(source: WebRenderPlugin.geolocationShim(lat: lat, lon: lon), injectionTime: .atDocumentStart, forMainFrameOnly: false))
        }

        let web = WKWebView(frame: host.bounds, configuration: config)
        web.customUserAgent = WebRenderPlugin.safariUserAgent()
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isUserInteractionEnabled = false
        web.accessibilityElementsHidden = true
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.insertSubview(web, at: 0) // behind the app's web view: laid out and running, never seen

        let j = Job(call: call, web: web, script: script)
        job = j
        j.timeout = Timer.scheduledTimer(withTimeInterval: Double(timeoutMs) / 1000, repeats: false) { [weak self] _ in
            self?.finish(j, result: nil, timedOut: true, error: nil)
        }
        j.poll = Timer.scheduledTimer(withTimeInterval: Double(pollMs) / 1000, repeats: true) { [weak self] _ in
            self?.poll(j)
        }
        web.load(URLRequest(url: url))
    }

    private func poll(_ j: Job) {
        if j.done { return }
        j.web.evaluateJavaScript(j.script) { [weak self] value, _ in
            guard let self = self, !j.done else { return }
            if let text = value as? String, WebRenderPlugin.hasData(text) {
                self.finish(j, result: text, timedOut: false, error: nil)
            }
        }
    }

    /// Resolves or rejects exactly once, and always tears the web view down.
    private func finish(_ j: Job, result: String?, timedOut: Bool, error: String?) {
        if j.done { return }
        j.done = true
        if job === j { job = nil }
        j.poll?.invalidate()
        j.timeout?.invalidate()
        let finalUrl = j.web.url?.absoluteString ?? ""
        j.web.stopLoading()
        j.web.navigationDelegate = nil
        j.web.uiDelegate = nil
        j.web.configuration.userContentController.removeAllUserScripts()
        j.web.removeFromSuperview()
        if let error = error {
            j.call.reject(error)
            return
        }
        j.call.resolve([
            "result": result.map { $0 as Any } ?? NSNull(),
            "timedOut": timedOut,
            "url": finalUrl
        ])
    }

    private func current(_ webView: WKWebView) -> Job? {
        guard let j = job, j.web === webView, !j.done else { return nil }
        return j
    }

    // ── WKNavigationDelegate ─────────────────────────────────────────────────

    // Stay on the web page: never hand off to another app (blinkit://, itms-apps://…).
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = navigationAction.request.url?.scheme?.lowercased() ?? ""
        let web = ["http", "https", "about", "blob", "data"].contains(scheme)
        decisionHandler(web ? .allow : .cancel)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failed(webView, error)
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed(webView, error)
    }

    private func failed(_ webView: WKWebView, _ error: Error) {
        let e = error as NSError
        // A cancelled load is just the page redirecting (or our own policy refusing an app link).
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return } // frame load interrupted
        if let j = current(webView) {
            finish(j, result: nil, timedOut: false, error: "Page didn't load: \(e.localizedDescription)")
        }
    }

    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if let j = current(webView) {
            finish(j, result: nil, timedOut: false, error: "The page stopped responding")
        }
    }

    // ── WKUIDelegate: nobody can see this page, so dismiss anything it tries to open ─────────

    public func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    public func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                        initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(false)
    }

    public func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                        defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        completionHandler(nil)
    }

    public func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                        for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        return nil // no pop-up windows
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static func hasData(_ value: String) -> Bool {
        let v = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return !v.isEmpty && v != "null" && v != "[]" && v != "\"\""
    }

    /// The phone's own Mobile Safari user agent — a bare WKWebView leaves out "Version/… Safari/…",
    /// which bot checks look for.
    private static func safariUserAgent() -> String {
        let os = UIDevice.current.systemVersion            // e.g. "18.6"
        let parts = os.split(separator: ".").map(String.init)
        let major = parts.first ?? "18", minor = parts.count > 1 ? parts[1] : "0"
        return "Mozilla/5.0 (iPhone; CPU iPhone OS \(os.replacingOccurrences(of: ".", with: "_")) like Mac OS X) "
            + "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/\(major).\(minor) Mobile/15E148 Safari/604.1"
    }

    /// navigator.geolocation (and the permission query) answered with the app's own GPS fix.
    private static func geolocationShim(lat: Double, lon: Double) -> String {
        return """
        (function () {
          var pos = { coords: { latitude: \(lat), longitude: \(lon), accuracy: 50, altitude: null,
            altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() };
          var geo = {
            getCurrentPosition: function (ok) { setTimeout(function () { ok(pos); }, 10); },
            watchPosition: function (ok) { setTimeout(function () { ok(pos); }, 10); return 1; },
            clearWatch: function () {}
          };
          try { Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true }); } catch (e) {}
          if (navigator.permissions && navigator.permissions.query) {
            var query = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = function (p) {
              return p && p.name === "geolocation" ? Promise.resolve({ state: "granted", onchange: null }) : query(p);
            };
          }
        })();
        """
    }
}
