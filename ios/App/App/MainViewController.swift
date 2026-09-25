import UIKit
import Capacitor

/// Capacitor's bridge view controller plus the app's own plugins (the iOS side of
/// android/…/MainActivity.java). Main.storyboard points at this class.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ExternalAppPlugin())
        bridge?.registerPluginInstance(WebRenderPlugin())
    }
}
