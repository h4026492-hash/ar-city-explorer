import Foundation

/// Minimal Landmark model used by ARViewController
public struct Landmark: Codable {
    public let id: String
    public let name: String
    public let lat: Double
    public let lng: Double

    public init(id: String, name: String, lat: Double, lng: Double) {
        self.id = id
        self.name = name
        self.lat = lat
        self.lng = lng
    }
}
