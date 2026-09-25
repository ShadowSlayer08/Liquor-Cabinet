import Foundation
import Capacitor

/// iOS side of ExternalAppPlugin.java — placeholder until the port lands.
@objc(ExternalAppPlugin)
public class ExternalAppPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalAppPlugin"
    public let jsName = "ExternalApp"
    public let pluginMethods: [CAPPluginMethod] = []
}
