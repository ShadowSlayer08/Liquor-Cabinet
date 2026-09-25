import Foundation
import Capacitor

/// iOS side of WebRenderPlugin.java — placeholder until the port lands.
@objc(WebRenderPlugin)
public class WebRenderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WebRenderPlugin"
    public let jsName = "WebRender"
    public let pluginMethods: [CAPPluginMethod] = []
}
