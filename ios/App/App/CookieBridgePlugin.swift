import Foundation
import WebKit
import Capacitor

/**
 * Puts a web sign-in and the app's own HTTP requests on the same cookies — iOS only.
 * On Android there's one cookie jar. On iOS the in-app browser (the Zomato sign-in,
 * @capacitor/inappbrowser) keeps its cookies in WKWebsiteDataStore.default(), while CapacitorHttp
 * (src/lib/http.js) sends HTTPCookieStorage.shared's, and Capacitor's own WebKit → HTTP sync can't
 * be relied on. Called from src/lib/zomatoAccount.js:
 *   pull({ domain })      copy the site's cookies from WebKit into HTTPCookieStorage → { count }
 *   clearSite({ domain }) remove the site's cookies and web data from both stores → { removed }
 */
@objc(CookieBridgePlugin)
public class CookieBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CookieBridgePlugin"
    public let jsName = "CookieBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSite", returnType: CAPPluginReturnPromise)
    ]

    @objc func pull(_ call: CAPPluginCall) {
        guard let domain = CookieBridgePlugin.domain(call) else {
            call.reject("domain is required")
            return
        }
        DispatchQueue.main.async {
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
                let site = cookies.filter { CookieBridgePlugin.matches($0.domain, domain) }
                for cookie in site { HTTPCookieStorage.shared.setCookie(cookie) }
                call.resolve(["count": site.count])
            }
        }
    }

    @objc func clearSite(_ call: CAPPluginCall) {
        guard let domain = CookieBridgePlugin.domain(call) else {
            call.reject("domain is required")
            return
        }
        DispatchQueue.main.async {
            for cookie in HTTPCookieStorage.shared.cookies ?? [] where CookieBridgePlugin.matches(cookie.domain, domain) {
                HTTPCookieStorage.shared.deleteCookie(cookie)
            }
            // Only this site's records — the store is shared with the app's own web view.
            let store = WKWebsiteDataStore.default()
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            store.fetchDataRecords(ofTypes: types) { records in
                let site = records.filter { CookieBridgePlugin.matches($0.displayName, domain) }
                store.removeData(ofTypes: types, for: site) {
                    call.resolve(["removed": site.count])
                }
            }
        }
    }

    private static func domain(_ call: CAPPluginCall) -> String? {
        let d = (call.getString("domain") ?? "").lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        return d.isEmpty ? nil : d
    }

    /// ".zomato.com", "www.zomato.com" and "zomato.com" all belong to "zomato.com".
    private static func matches(_ name: String, _ domain: String) -> Bool {
        let d = name.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        return d == domain || d.hasSuffix("." + domain)
    }
}
