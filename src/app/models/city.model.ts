/**
 * City model for multi-city support
 */
export interface City {
  id: string;
  name: string;
  country: string;
  centerLat: number;
  centerLng: number;
  isAvailable: boolean;
  isPremium: boolean;
  landmarkCount?: number;
  thumbnailUrl?: string;
  description?: string;
}
