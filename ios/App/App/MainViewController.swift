import UIKit
import Capacitor

/// Capacitor's bridge view controller plus the app's own plugins — the iOS side of
/// android/…/MainActivity.java. SceneDelegate creates it (the template's storyboard isn't used).
/// OrderBubblePlugin has no iOS version: iOS doesn't let apps draw over other apps.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ExternalAppPlugin())
        bridge?.registerPluginInstance(WebRenderPlugin())
        bridge?.registerPluginInstance(CookieBridgePlugin())
        #if DEBUG
        // CI (scripts/ci/ios-screenshots.sh) launches the Simulator build with LC_OPEN_URL set to
        // e.g. liquorcabinet://tab/bar, instead of `simctl openurl`, which stops at an "Open in…?"
        // prompt. Handing it to Capacitor like a real URL open makes App.getLaunchUrl() return it.
        if let link = ProcessInfo.processInfo.environment["LC_OPEN_URL"], let url = URL(string: link) {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
        }
        #endif
    }
}
