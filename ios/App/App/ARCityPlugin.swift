import Capacitor
import UIKit

@objc(ARCityPlugin)
public class ARCityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ARCityPlugin"
    public let jsName = "ARCityPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openAR", returnType: CAPPluginReturnPromise)
    ]
    
    // Required initializer for plugin instance registration
    public required override init() {
        super.init()
    }

    override public func load() {
        print("ARCityPlugin: plugin loaded and registered")
    }

    @objc public func openAR(_ call: CAPPluginCall) {
        print("ARCityPlugin: openAR called")
        let landmarks = call.getArray("landmarks", JSObject.self) ?? []
        print("ARCityPlugin: received \(landmarks.count) landmarks")

        DispatchQueue.main.async {
            print("ARCityPlugin: presenting ARViewController")
            
            guard let bridgeVC = self.bridge?.viewController else {
                print("ARCityPlugin: ERROR - bridge viewController is nil!")
                call.reject("No view controller available")
                return
            }
            
            print("ARCityPlugin: bridge viewController found, presenting...")
            
            // Listen for landmark taps
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(self.onLandmarkTap(_:)),
                name: NSNotification.Name("AR_LANDMARK_TAP"),
                object: nil
            )
            
            let vc = ARViewController()
            vc.landmarks = landmarks
            vc.modalPresentationStyle = .fullScreen
            bridgeVC.present(vc, animated: true) {
                print("ARCityPlugin: ARViewController presented successfully")
            }
            call.resolve()
        }
    }
    
    @objc func onLandmarkTap(_ notification: Notification) {
        if let landmarkId = notification.object as? String {
            self.notifyListeners("landmarkTap", data: ["id": landmarkId])
        }
    }
}
