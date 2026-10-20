import Foundation
import Capacitor
import WidgetKit

// Writes the home-screen snapshot to the shared App Group so the widget can read it.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "RestockWidget"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setSnapshot", returnType: CAPPluginReturnPromise)]
    static let group = "group.com.pocketappstudio.restock"

    @objc func setSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let ud = UserDefaults(suiteName: Self.group) else { call.resolve(); return }
        if ud.string(forKey: "snapshot") != json {
            ud.set(json, forKey: "snapshot")
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}

class RestockViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
