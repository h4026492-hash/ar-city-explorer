/**
 * ARViewController - Production Hardened
 *
 * Purpose: AR view for displaying landmarks in augmented reality.
 *
 * Safety Features:
 * - Camera permission detection with fallback UI
 * - ARKit device support detection
 * - Memory pressure handling (releases resources on warning)
 * - Clean session cleanup (no double initialization)
 * - Graceful error handling (no crashes)
 *
 * App Store Compliance:
 * - Camera permission is REQUIRED for AR features only
 * - Clear fallback messaging for unsupported devices
 * - Proper session lifecycle management
 *
 * Privacy Note: Camera feed is processed locally only.
 * No images or video are recorded, stored, or transmitted.
 */

import UIKit
import ARKit
import CoreLocation
import Capacitor

class ARViewController: UIViewController, CLLocationManagerDelegate, ARSessionDelegate {
    var sceneView: ARSCNView!
    var landmarks: [JSObject] = []
    
    let locationManager = CLLocationManager()
    var userLocation: CLLocation?
    var userHeading: CLLocationDirection = 0
    var hasRendered = false
    
    // Safety flags
    private var isSessionRunning = false
    private var hasShownPermissionAlert = false
    private var isMemoryWarningActive = false
    
    // Fallback UI
    private var fallbackView: UIView?
    private var fallbackLabel: UILabel?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        print("ARViewController: viewDidLoad called")
        print("ARViewController: received \(landmarks.count) landmarks")
        
        // DEBUG: Uncomment next 2 lines to test if view is being presented
        // view.backgroundColor = .red
        // return
        
        print("ARViewController: checking ARKit support...")
        
        // Check ARKit support FIRST
        guard ARWorldTrackingConfiguration.isSupported else {
            print("ARViewController: ARKit NOT supported on this device")
            showFallbackUI(message: "AR is not supported on this device.\n\nYou can still explore Dallas landmarks using the map and list views.")
            return
        }
        
        print("ARViewController: ARKit supported, checking camera permission...")
        
        // Check camera permission
        checkCameraPermission()
    }
    
    // ─────────────────────────────────────────────────────
    // CAMERA PERMISSION HANDLING
    // ─────────────────────────────────────────────────────
    
    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            print("ARViewController: camera authorized, setting up AR scene...")
            setupARScene()
        case .notDetermined:
            print("ARViewController: camera permission not determined, requesting...")
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        print("ARViewController: camera permission granted")
                        self?.setupARScene()
                    } else {
                        print("ARViewController: camera permission denied by user")
                        self?.showPermissionDeniedUI()
                    }
                }
            }
        case .denied, .restricted:
            print("ARViewController: camera permission denied or restricted")
            showPermissionDeniedUI()
        @unknown default:
            print("ARViewController: camera permission unknown state")
            showFallbackUI(message: "Camera access could not be determined.")
        }
    }
    
    private func showPermissionDeniedUI() {
        guard !hasShownPermissionAlert else { return }
        hasShownPermissionAlert = true
        
        showFallbackUI(
            message: "Camera access is required for AR features.\n\nTo enable, go to Settings > Privacy > Camera and allow access for this app.",
            showSettingsButton: true
        )
    }
    
    private func showFallbackUI(message: String, showSettingsButton: Bool = false) {
        // Create fallback view
        fallbackView = UIView(frame: view.bounds)
        fallbackView?.backgroundColor = UIColor.black.withAlphaComponent(0.9)
        fallbackView?.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        // Message label
        let label = UILabel()
        label.text = message
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = UIFont.systemFont(ofSize: 17, weight: .medium)
        label.translatesAutoresizingMaskIntoConstraints = false
        fallbackView?.addSubview(label)
        fallbackLabel = label
        
        // Close button
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close", for: .normal)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.backgroundColor = UIColor.white.withAlphaComponent(0.2)
        closeButton.layer.cornerRadius = 12
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(closeAR), for: .touchUpInside)
        fallbackView?.addSubview(closeButton)
        
        // Settings button (optional)
        var settingsButton: UIButton?
        if showSettingsButton {
            settingsButton = UIButton(type: .system)
            settingsButton?.setTitle("Open Settings", for: .normal)
            settingsButton?.setTitleColor(.white, for: .normal)
            settingsButton?.backgroundColor = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
            settingsButton?.layer.cornerRadius = 12
            settingsButton?.translatesAutoresizingMaskIntoConstraints = false
            settingsButton?.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
            fallbackView?.addSubview(settingsButton!)
        }
        
        view.addSubview(fallbackView!)
        
        // Layout constraints
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: fallbackView!.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: fallbackView!.centerYAnchor, constant: -40),
            label.leadingAnchor.constraint(equalTo: fallbackView!.leadingAnchor, constant: 40),
            label.trailingAnchor.constraint(equalTo: fallbackView!.trailingAnchor, constant: -40),
            
            closeButton.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 30),
            closeButton.centerXAnchor.constraint(equalTo: fallbackView!.centerXAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 120),
            closeButton.heightAnchor.constraint(equalToConstant: 44)
        ])
        
        if let settingsButton = settingsButton {
            NSLayoutConstraint.activate([
                settingsButton.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 15),
                settingsButton.centerXAnchor.constraint(equalTo: fallbackView!.centerXAnchor),
                settingsButton.widthAnchor.constraint(equalToConstant: 160),
                settingsButton.heightAnchor.constraint(equalToConstant: 44)
            ])
        }
    }
    
    @objc private func openSettings() {
        if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsURL)
        }
    }
    
    // ─────────────────────────────────────────────────────
    // AR SCENE SETUP (only called if authorized)
    // ─────────────────────────────────────────────────────
    
    private func setupARScene() {
        print("ARViewController: setupARScene() called")
        
        // Prevent double initialization
        guard !isSessionRunning else {
            print("ARViewController: AR session already running, skipping setup")
            return
        }
        
        print("ARViewController: creating ARSCNView...")
        sceneView = ARSCNView(frame: view.bounds)
        sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        sceneView.session.delegate = self
        view.addSubview(sceneView)
        print("ARViewController: ARSCNView added to view")
        
        sceneView.scene = SCNScene()
        
        // Add close button
        let closeButton = UIButton(type: .system)
        closeButton.setTitle("✕", for: .normal)
        closeButton.titleLabel?.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        closeButton.layer.cornerRadius = 20
        closeButton.frame = CGRect(x: 20, y: 50, width: 40, height: 40)
        closeButton.addTarget(self, action: #selector(closeAR), for: .touchUpInside)
        view.addSubview(closeButton)
        
        // Configure AR session with heading
        print("ARViewController: configuring AR session...")
        let config = ARWorldTrackingConfiguration()
        config.worldAlignment = .gravityAndHeading
        sceneView.session.run(config)
        isSessionRunning = true
        print("ARViewController: AR session started successfully")
        
        // Add tap gesture recognizer
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        sceneView.addGestureRecognizer(tap)
        
        // Setup location manager
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.startUpdatingHeading()
        print("ARViewController: location manager started")
    }
    
    // ─────────────────────────────────────────────────────
    // MEMORY PRESSURE HANDLING
    // ─────────────────────────────────────────────────────
    
    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        
        print("⚠️ Memory warning received in AR view")
        isMemoryWarningActive = true
        
        // Release heavy resources
        releaseARResources()
        
        // Pause session if running
        if isSessionRunning {
            sceneView?.session.pause()
        }
    }
    
    private func releaseARResources() {
        // Clear all rendered nodes to free memory
        sceneView?.scene.rootNode.childNodes.forEach { $0.removeFromParentNode() }
        
        // Clear landmark cache
        hasRendered = false
    }
    
    // ARSessionDelegate - handle session interruption
    func sessionWasInterrupted(_ session: ARSession) {
        print("AR session interrupted")
    }
    
    func sessionInterruptionEnded(_ session: ARSession) {
        print("AR session interruption ended")
        
        // Resume if memory warning has cleared
        if !isMemoryWarningActive {
            if let config = session.configuration {
                session.run(config, options: [.resetTracking])
            }
        }
    }
    
    func session(_ session: ARSession, didFailWithError error: Error) {
        print("AR session error: \(error.localizedDescription)")
        
        // Show user-friendly error
        showFallbackUI(message: "AR session encountered an issue.\n\nPlease close and try again.")
    }
    
    @objc func handleTap(_ gesture: UITapGestureRecognizer) {
        let location = gesture.location(in: sceneView)
        let hits = sceneView.hitTest(location, options: nil)
        
        guard let node = hits.first?.node else { return }
        
        // Check this node or its parent for landmark ID
        var currentNode: SCNNode? = node
        while currentNode != nil {
            if let landmarkId = currentNode?.name, !landmarkId.isEmpty {
                notifyAngular(landmarkId: landmarkId)
                return
            }
            currentNode = currentNode?.parent
        }
    }
    
    func notifyAngular(landmarkId: String) {
        NotificationCenter.default.post(
            name: NSNotification.Name("AR_LANDMARK_TAP"),
            object: landmarkId
        )
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        cleanupARSession()
    }
    
    /**
     * Clean up AR resources safely
     * Called on dismiss and memory warnings
     */
    private func cleanupARSession() {
        // Stop AR session
        if isSessionRunning {
            sceneView?.session.pause()
            isSessionRunning = false
        }
        
        // Stop location updates
        locationManager.stopUpdatingLocation()
        locationManager.stopUpdatingHeading()
        
        // Clear rendered nodes
        sceneView?.scene.rootNode.childNodes.forEach { $0.removeFromParentNode() }
        
        // Reset flags
        hasRendered = false
        isMemoryWarningActive = false
    }
    
    @objc func closeAR() {
        cleanupARSession()
        dismiss(animated: true)
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        userLocation = locations.last
        renderLandmarks()
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        userHeading = newHeading.trueHeading
        renderLandmarks()
    }
    
    func renderLandmarks() {
        guard let userLocation = userLocation else { return }
        
        // Clear existing nodes
        sceneView.scene.rootNode.childNodes.forEach { $0.removeFromParentNode() }
        
        for landmark in landmarks {
            guard
                let lat = landmark["lat"] as? Double,
                let lng = landmark["lng"] as? Double,
                let name = landmark["name"] as? String
            else { continue }
            
            let landmarkLocation = CLLocation(latitude: lat, longitude: lng)
            let distance = userLocation.distance(from: landmarkLocation)
            
            // Only show landmarks within 1500m
            if distance > 1500 { continue }
            
            let bearing = bearingBetween(userLocation, landmarkLocation)
            let angle = bearing - degreesToRadians(userHeading)
            
            // Scale distance for AR (1m in AR = 100m real world)
            let arDistance = min(Float(distance / 100), 15.0)
            
            let x = Float(sin(angle)) * arDistance
            let z = -Float(cos(angle)) * arDistance
            
            let node = createCard(
                title: name,
                description: "Dallas landmark",
                distance: "\(Int(distance)) m"
            )
            
            // Tag node with landmark ID for tap detection
            node.name = landmark["id"] as? String
            
            node.position = SCNVector3(x, 0, z)
            node.constraints = [SCNBillboardConstraint()]
            sceneView.scene.rootNode.addChildNode(node)
        }
    }
    
    func createCard(title: String, description: String, distance: String) -> SCNNode {
        let cardNode = SCNNode()
        
        let cardWidth: CGFloat = 0.3
        let cardHeight: CGFloat = 0.15
        let cardPlane = SCNPlane(width: cardWidth, height: cardHeight)
        
        let material = SCNMaterial()
        material.diffuse.contents = createCardImage(title: title, description: description, distance: distance, width: 300, height: 150)
        material.isDoubleSided = true
        cardPlane.materials = [material]
        
        let cardBackground = SCNNode(geometry: cardPlane)
        cardNode.addChildNode(cardBackground)
        
        return cardNode
    }
    
    func createCardImage(title: String, description: String, distance: String, width: Int, height: Int) -> UIImage {
        let size = CGSize(width: width, height: height)
        let renderer = UIGraphicsImageRenderer(size: size)
        
        return renderer.image { context in
            // Modern frosted glass background
            let bgColor = UIColor(white: 0.12, alpha: 0.92)
            bgColor.setFill()
            
            let cardRect = CGRect(origin: .zero, size: size)
            let cardPath = UIBezierPath(roundedRect: cardRect, cornerRadius: 20)
            cardPath.fill()
            
            // Subtle border
            UIColor.white.withAlphaComponent(0.15).setStroke()
            cardPath.lineWidth = 1
            cardPath.stroke()
            
            // Title - SF Pro style
            let titleAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 20, weight: .semibold),
                .foregroundColor: UIColor.white
            ]
            let titleString = NSAttributedString(string: title, attributes: titleAttributes)
            titleString.draw(at: CGPoint(x: 18, y: 18))
            
            // Description
            let descAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 13, weight: .regular),
                .foregroundColor: UIColor.white.withAlphaComponent(0.7)
            ]
            let descString = NSAttributedString(string: description, attributes: descAttributes)
            descString.draw(at: CGPoint(x: 18, y: 48))
            
            // Distance badge - accent color
            let badgeRect = CGRect(x: 18, y: size.height - 38, width: 70, height: 24)
            UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0).setFill()
            UIBezierPath(roundedRect: badgeRect, cornerRadius: 12).fill()
            
            let distanceAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
                .foregroundColor: UIColor.white
            ]
            let distanceString = NSAttributedString(string: distance, attributes: distanceAttributes)
            let textSize = distanceString.size()
            let textX = badgeRect.midX - textSize.width / 2
            let textY = badgeRect.midY - textSize.height / 2
            distanceString.draw(at: CGPoint(x: textX, y: textY))
        }
    }
}

// Helper functions for GPS calculations
func degreesToRadians(_ degrees: Double) -> Double {
    return degrees * .pi / 180
}

func bearingBetween(_ from: CLLocation, _ to: CLLocation) -> Double {
    let lat1 = degreesToRadians(from.coordinate.latitude)
    let lon1 = degreesToRadians(from.coordinate.longitude)
    let lat2 = degreesToRadians(to.coordinate.latitude)
    let lon2 = degreesToRadians(to.coordinate.longitude)
    
    let dLon = lon2 - lon1
    
    let y = sin(dLon) * cos(lat2)
    let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
    
    return atan2(y, x)
}
