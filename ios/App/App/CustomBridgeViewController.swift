import UIKit
import Capacitor

@objc(CustomBridgeViewController)
public class CustomBridgeViewController: CAPBridgeViewController {
    
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        
        // Register our custom AR plugin
        bridge?.registerPluginInstance(ARCityPlugin())
        print("CustomBridgeViewController: ARCityPlugin registered")
    }
}
