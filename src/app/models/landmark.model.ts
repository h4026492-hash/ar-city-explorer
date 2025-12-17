// Landmark model for typed landmarks across the app

export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  shortDescription?: string;
}

// Landmark with calculated distance (used in list views)
export interface LandmarkWithDistance extends Landmark {
  distance?: number; // meters
  formattedDistance?: string;
}
