import Foundation
import UIKit
import Capacitor

/**
 * Hands orders off to Zomato / Bistro / Blinkit / Google Maps / WhatsApp — the iOS side of
 * ExternalAppPlugin.java, with the same JS contract (src/lib/order.js):
 *   open({ url, pkg, fallback }) → { opened: "app" | "browser" }
 *   launch({ pkg, fallback })    → { opened }
 *   isInstalled({ pkg })         → { installed }
 * iOS has no package names, so the Android ones order.js passes are mapped to what iOS offers:
 * Zomato's zomato:// scheme, Google Maps' comgooglemaps://, and universal links — https links an
 * installed app claims (blinkit.com/s/*, bistro.blinkit.com, google.com/maps/search/*, wa.me).
 * Opening with .universalLinksOnly tells us whether an app took the link; if none did, the
 * link opens in Safari instead.
 */
@objc(ExternalAppPlugin)
public class ExternalAppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalAppPlugin"
    public let jsName = "ExternalApp"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "launch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isInstalled", returnType: CAPPluginReturnPromise)
    ]

    /// Android package → the iOS app's URL scheme (canOpenURL needs it in Info.plist's LSApplicationQueriesSchemes).
    private static let schemes: [String: String] = [
        "com.application.zomato": "zomato",
        "com.google.android.apps.maps": "comgooglemaps",
        "com.whatsapp": "whatsapp"
    ]

    /// Android package → a universal link that opens the iOS app (launch() has no "start by package" on iOS).
    private static let homes: [String: String] = [
        "com.grofers.customerapp": "https://blinkit.com/",
        "com.blinkit.bistro": "https://bistro.blinkit.com/",
        "com.application.zomato": "https://www.zomato.com/",
        "com.google.android.apps.maps": "https://www.google.com/maps/"
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), !raw.isEmpty, let url = URL(string: raw) else {
            call.reject("url is required")
            return
        }
        let pkg = call.getString("pkg")
        let fallback = call.getString("fallback").flatMap { URL(string: $0) }
        DispatchQueue.main.async {
            // Google Maps' own app understands comgooglemaps://?q=… — use it when it's installed.
            if pkg == "com.google.android.apps.maps",
               let maps = ExternalAppPlugin.googleMapsURL(for: url),
               UIApplication.shared.canOpenURL(maps) {
                UIApplication.shared.open(maps, options: [:]) { ok in
                    if ok {
                        call.resolve(["opened": "app"])
                    } else {
                        self.openLink(url, fallback: fallback, call)
                    }
                }
                return
            }
            self.openLink(url, fallback: fallback, call)
        }
    }

    @objc func launch(_ call: CAPPluginCall) {
        let pkg = call.getString("pkg") ?? ""
        let fallback = call.getString("fallback").flatMap { URL(string: $0) }
        guard let target = ExternalAppPlugin.homes[pkg].flatMap({ URL(string: $0) }) ?? fallback else {
            call.reject("Cannot open \(pkg)")
            return
        }
        DispatchQueue.main.async {
            self.openLink(target, fallback: fallback, call)
        }
    }

    @objc func isInstalled(_ call: CAPPluginCall) {
        let pkg = call.getString("pkg") ?? ""
        DispatchQueue.main.async {
            // Only apps with a known scheme can be checked; for the rest iOS can't tell (→ false).
            var installed = false
            if let scheme = ExternalAppPlugin.schemes[pkg], let probe = URL(string: "\(scheme)://") {
                installed = UIApplication.shared.canOpenURL(probe)
            }
            call.resolve(["installed": installed])
        }
    }

    /// http(s): the app that claims the universal link, else Safari. Other schemes (zomato://…):
    /// the app, else `fallback`. Resolves or rejects `call` exactly once. Main thread only.
    private func openLink(_ url: URL, fallback: URL?, _ call: CAPPluginCall) {
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "http" || scheme == "https" {
            UIApplication.shared.open(url, options: [.universalLinksOnly: true]) { inApp in
                if inApp {
                    call.resolve(["opened": "app"])
                    return
                }
                UIApplication.shared.open(url, options: [:]) { ok in
                    if ok {
                        call.resolve(["opened": "browser"])
                    } else if let fallback = fallback, fallback != url {
                        self.openLink(fallback, fallback: nil, call)
                    } else {
                        call.reject("No app can open \(url.absoluteString)")
                    }
                }
            }
            return
        }
        UIApplication.shared.open(url, options: [:]) { ok in
            if ok {
                call.resolve(["opened": "app"])
            } else if let fallback = fallback, fallback != url {
                self.openLink(fallback, fallback: nil, call)
            } else {
                call.reject("No app can open \(url.absoluteString)")
            }
        }
    }

    /// https://www.google.com/maps/search/?api=1&query=liquor+store → comgooglemaps://?q=liquor+store
    private static func googleMapsURL(for url: URL) -> URL? {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems,
              let query = items.first(where: { $0.name == "query" || $0.name == "q" })?.value else {
            return nil
        }
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=+?#")
        guard let q = query.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
        return URL(string: "comgooglemaps://?q=\(q)")
    }
}
