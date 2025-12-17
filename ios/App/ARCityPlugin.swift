import Capacitor
import UIKit
import ARKit

@objc(ARCityPlugin)
public class ARCityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ARCityPlugin"
    public let jsName = "ARCityPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openAR", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "highlightLandmark", returnType: CAPPluginReturnPromise)
    ]
    
    // Required initializer for plugin instance registration
    public required override init() {
        super.init()
    }

    // Keep a weak reference to the most recently presented ARViewController
    private weak var currentARVC: ARViewController?

    override public func load() {
        print("ARCityPlugin: plugin loaded and registered")
    }

    @objc public func openAR(_ call: CAPPluginCall) {
        print("ARCityPlugin: openAR called")
        let jsLandmarks = call.getArray("landmarks", JSObject.self) ?? []
        print("ARCityPlugin: received \(jsLandmarks.count) landmarks from JS")

        // Convert JS objects into native Landmark structs
        let nativeLandmarks: [Landmark] = jsLandmarks.compactMap { obj in
            guard
                let id = obj["id"] as? String,
                let name = obj["name"] as? String,
                let lat = obj["lat"] as? Double,
                let lng = obj["lng"] as? Double
            else { return nil }

            return Landmark(id: id, name: name, lat: lat, lng: lng)
        }
        print("ARCityPlugin: converted to \(nativeLandmarks.count) native landmarks")

        DispatchQueue.main.async {
            // Early check for ARKit world tracking support so JS can react immediately
            if !ARWorldTrackingConfiguration.isSupported {
                print("ARCityPlugin: ARWorldTrackingConfiguration NOT supported on this device")
                call.resolve(["supported": false, "message": "ARKit not supported on this device"])
                return
            }

            print("ARCityPlugin: presenting ARViewController")
            
            guard let bridgeVC = self.bridge?.viewController else {
                print("ARCityPlugin: ERROR - bridge viewController is nil!")
                call.reject("No view controller available")
                return
            }
            
            print("ARCityPlugin: bridge viewController found, presenting...")
            
            // We'll use direct plugin callbacks from ARViewController (vc.plugin = self) instead of NotificationCenter
            
            let vc = ARViewController()
            // Give ARViewController a weak reference back to this plugin so it can notify JS directly
            vc.plugin = self
            // Track current AR VC for plugin method calls
            self.currentARVC = vc
            vc.landmarks = nativeLandmarks
            vc.modalPresentationStyle = .fullScreen
            bridgeVC.present(vc, animated: true) {
                print("ARCityPlugin: ARViewController presented successfully")
                // Indicate success to JS with explicit true flag
                call.resolve(["supported": true])
            }
            // Note: resolution is handled in the presentation completion above
        }
    }
    
    @objc func onLandmarkTap(_ notification: Notification) {
        if let landmarkId = notification.object as? String {
            self.notifyListeners("landmarkTap", data: ["id": landmarkId])
        }
    }

    /// Notify JS listeners that a landmark was tapped
    /// Payload includes id, name, lat, lng
    public func notifyLandmarkTapped(_ landmark: Landmark) {
        let payload: [String: Any] = [
            "id": landmark.id,
            "name": landmark.name,
            "lat": landmark.lat,
            "lng": landmark.lng
        ]
        self.notifyListeners("landmarkTapped", data: payload)
    }

    /// Notify JS listeners with a prepared payload (allows additional fields like distance)
    public func notifyLandmarkTappedPayload(_ payload: [String: Any]) {
        self.notifyListeners("landmarkTapped", data: payload)
    }

    /// Highlight a landmark in the currently presented AR view (if available)
    @objc public func highlightLandmark(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("missing id")
            return
        }

        DispatchQueue.main.async {
            if let vc = self.currentARVC {
                vc.highlightLandmark(id: id)
                call.resolve()
            } else {
                call.reject("no AR view available")
            }
        }
    }
}
