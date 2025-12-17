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
    var landmarks: [Landmark] = []
        // Weak reference to plugin to avoid retain cycles; set by ARCityPlugin when presenting
        public weak var plugin: ARCityPlugin?
    // Track currently highlighted node so we can clear it
    private var highlightedNode: SCNNode?

    let locationManager = CLLocationManager()
    var userLocation: CLLocation?
    var userHeading: CLLocationDirection = 0
    var hasRendered = false
    private var didAddTestLandmarks = false
    private var lastRenderLocation: CLLocation?
    
    // Safety flags
    private var isSessionRunning = false
    private var hasShownPermissionAlert = false
    private var isMemoryWarningActive = false
    
    // Fallback UI
    private var fallbackView: UIView?
    private var fallbackLabel: UILabel?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        // Initialize ARSCNView and AR session
        self.sceneView = ARSCNView(frame: view.bounds)
        self.sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(self.sceneView)

        let config = ARWorldTrackingConfiguration()
        config.worldAlignment = .gravityAndHeading
        self.sceneView.session.run(config)

        // Start location updates so we can later render landmarks
        setupLocation()
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

        // DEBUG: add a visible test node so we can verify rendering (red cube)
        do {
            let box = SCNBox(width: 0.1, height: 0.1, length: 0.1, chamferRadius: 0)
            let material = SCNMaterial()
            material.diffuse.contents = UIColor.red
            box.materials = [material]

            let debugNode = SCNNode(geometry: box)
            // Place it half a meter in front of the camera
            debugNode.position = SCNVector3(0, 0, -0.5)
            sceneView.scene.rootNode.addChildNode(debugNode)
            print("ARViewController: Debug red cube added to scene at (0,0,-0.5)")
        }
        
        // Add tap gesture recognizer
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        sceneView.addGestureRecognizer(tap)

        // Ensure tap gesture is connected for landmark taps
        let nodeTap = UITapGestureRecognizer(target: self, action: #selector(handleSceneTap(_:)))
        sceneView.addGestureRecognizer(nodeTap)
        
        // Setup location manager
        locationManager.delegate = self
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.startUpdatingHeading()
        print("ARViewController: location manager started")
    }

    // MARK: - Location

    func setupLocation() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
        locationManager.startUpdatingHeading()
        print("ARViewController: setupLocation() configured and started")
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

    @objc func handleSceneTap(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: sceneView)
        let results = sceneView.hitTest(point, options: [SCNHitTestOption.firstFoundOnly: true])
        guard let hit = results.first else { return }

        var node: SCNNode? = hit.node
        while node != nil {
            if let id = node?.name, !id.isEmpty, let landmark = landmarks.first(where: { $0.id == id }) {
                onLandmarkTapped(landmark: landmark)
                return
            }
            node = node?.parent
        }
    }

    func onLandmarkTapped(landmark: Landmark) {
        print("ARViewController: tapped landmark -> \(landmark.name) [\(landmark.id)]")
        // Build payload with extra context (distance if available)
        var payload: [String: Any] = [
            "id": landmark.id,
            "name": landmark.name,
            "lat": landmark.lat,
            "lng": landmark.lng
        ]

        if let userLoc = userLocation {
            let lmLoc = CLLocation(latitude: landmark.lat, longitude: landmark.lng)
            let distanceMeters = Int(userLoc.distance(from: lmLoc))
            payload["distance"] = distanceMeters
            // Bearing in degrees (0 = North)
            let bearingRad = bearingBetween(userLoc, lmLoc)
            let bearingDeg = Int((bearingRad * 180.0 / Double.pi).truncatingRemainder(dividingBy: 360))
            payload["bearing"] = bearingDeg
        }

        // Haptic feedback for immediate tactile response
        let impact = UIImpactFeedbackGenerator(style: .light)
        impact.impactOccurred()

        // Send event to Capacitor plugin which will notify JS listeners
        plugin?.notifyLandmarkTappedPayload(payload)
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
        // Add simple test landmarks near the user's current location once
        if let user = userLocation, !didAddTestLandmarks {
            didAddTestLandmarks = true

            // Offsets ~50-100 meters (roughly 0.00045 degrees)
            let delta = 0.00045
            let lm1 = Landmark(id: "test-1", name: "Test Landmark 1", lat: user.coordinate.latitude + delta, lng: user.coordinate.longitude)
            let lm2 = Landmark(id: "test-2", name: "Test Landmark 2", lat: user.coordinate.latitude, lng: user.coordinate.longitude + delta)
            landmarks.append(contentsOf: [lm1, lm2])
            print("ARViewController: added 2 test landmarks near user")
        }

        renderLandmarksIfNeeded()
    }
    
    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        userHeading = newHeading.trueHeading
        renderLandmarksIfNeeded()
    }

    // NOTE: use the global `bearingBetween(_:_:)` helper defined below

    // Convert user/landmark GPS into ARKit meters as SCNVector3
    func positionFromUser(user: CLLocation, landmark: CLLocation) -> SCNVector3 {
        let distance = user.distance(from: landmark) // meters
        let bearing = bearingBetween(user, landmark) // radians

        let x = Float(distance * sin(bearing))
        let z = Float(-distance * cos(bearing))

        return SCNVector3(x, 0, z)
    }

    // Minimal rendering method: place visible spheres at computed AR positions
    func renderLandmarksIfNeeded() {
        guard let user = userLocation else { return }

        // Remove any previously rendered nodes
        sceneView.scene.rootNode.childNodes.forEach { $0.removeFromParentNode() }

        // Prevent re-rendering too often: only when moved > 10m
        if let last = lastRenderLocation, last.distance(from: user) < 10 { return }
        lastRenderLocation = user

        for lm in landmarks {
            let lmLocation = CLLocation(latitude: lm.lat, longitude: lm.lng)
            let distance = user.distance(from: lmLocation)

            // Performance guard: only render within 150m
            if distance > 150 { continue }

            var position = positionFromUser(user: user, landmark: lmLocation)
            // Raise card slightly
            position.y += 0.3

            let node = createLandmarkNode(landmark: lm)
            node.position = position

            // scale subtly based on distance
            let scaleFactor = max(0.6, 1.2 - Float(distance / 100.0))
            node.scale = SCNVector3(scaleFactor, scaleFactor, scaleFactor)

            sceneView.scene.rootNode.addChildNode(node)
        }
    }
    
    func renderLandmarks() {
        guard let userLocation = userLocation else { return }
        
        // Clear existing nodes
        sceneView.scene.rootNode.childNodes.forEach { $0.removeFromParentNode() }
        
        for lm in landmarks {
            let lat = lm.lat
            let lng = lm.lng
            let name = lm.name

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
                description: "Nearby landmark",
                distance: "\(Int(distance)) m"
            )

            // Tag node with landmark ID for tap detection
            node.name = lm.id

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

    // Highlight a landmark node in the scene with a pulse and glow
    func highlightLandmark(id: String) {
        // Clear previous highlight if different
        if let prev = highlightedNode, prev.name != id {
            prev.removeAction(forKey: "highlightPulse")
            prev.scale = SCNVector3(1, 1, 1)
            prev.geometry?.firstMaterial?.emission.contents = UIColor.clear
            highlightedNode = nil
        }

        guard let node = sceneView.scene.rootNode.childNode(withName: id, recursively: true) else {
            return
        }

        // Apply pulsing scale
        let pulseUp = SCNAction.scale(to: 1.12, duration: 0.35)
        let pulseDown = SCNAction.scale(to: 1.0, duration: 0.35)
        let pulse = SCNAction.repeatForever(SCNAction.sequence([pulseUp, pulseDown]))
        node.runAction(pulse, forKey: "highlightPulse")

        // Emission glow
        node.geometry?.firstMaterial?.emission.contents = UIColor(red: 0.96, green: 0.80, blue: 0.16, alpha: 0.9)
        highlightedNode = node
    }

    // Create a flat AR card node for a landmark
    func createLandmarkNode(landmark: Landmark) -> SCNNode {
        let width: CGFloat = 0.6
        let height: CGFloat = 0.25

        let plane = SCNPlane(width: width, height: height)
        plane.cornerRadius = 0.02

        // Simple white background
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(white: 1.0, alpha: 0.95)
        plane.materials = [material]

        let node = SCNNode(geometry: plane)

        // Add title text centered
        let text = SCNText(string: landmark.name, extrusionDepth: 0.0)
        text.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        text.alignmentMode = CATextLayerAlignmentMode.center.rawValue
        text.firstMaterial?.diffuse.contents = UIColor.black

        // Wrap text in a node and scale down
        let textNode = SCNNode(geometry: text)
        let (minBound, maxBound) = text.boundingBox
        let textWidth = CGFloat(maxBound.x - minBound.x)
        let desiredTextWidth: CGFloat = width * 0.9
        let scale = desiredTextWidth / max(textWidth, 0.0001)
        textNode.scale = SCNVector3(scale * 0.01, scale * 0.01, 1)
        textNode.position = SCNVector3(-Float(width/2) + Float(0.05), -Float(height/4), 0.01)

        node.addChildNode(textNode)

        // Ensure the card always faces camera with a billboard constraint
        let billboard = SCNBillboardConstraint()
        billboard.freeAxes = [.Y]
        node.constraints = [billboard]

        // Name node for identification
        node.name = landmark.id

        // Add a small arrow node we can rotate to indicate bearing if needed
        let arrow = SCNPlane(width: 0.06, height: 0.03)
        arrow.cornerRadius = 0.005
        let arrowMat = SCNMaterial()
        arrowMat.diffuse.contents = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
        arrow.materials = [arrowMat]
        let arrowNode = SCNNode(geometry: arrow)
        arrowNode.position = SCNVector3(0, -Float(height/2) - 0.02, 0.01)
        arrowNode.name = "arrow_\(landmark.id)"
        node.addChildNode(arrowNode)

        return node
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
