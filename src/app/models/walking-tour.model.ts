/**
 * Walking Tour Model
 * 
 * Represents a curated walking tour experience.
 * Tours can be free or premium, with preview limits for free users.
 */

export interface WalkingTour {
  id: string;
  title: string;
  description: string;
  cityId: string;
  landmarkIds: string[];           // Ordered list of landmarks in the tour
  durationMinutes: number;         // Estimated walking time
  distanceMeters: number;          // Total distance
  isPremium: boolean;              // Requires subscription
  previewLandmarkCount: number;    // Free users can see this many landmarks
  difficulty?: 'easy' | 'moderate' | 'challenging';
  theme?: string;                  // e.g., "history", "architecture", "food"
  imageUrl?: string;               // Cover image for the tour
}

export interface TourProgress {
  tourId: string;
  currentLandmarkIndex: number;
  visitedLandmarkIds: string[];
  startedAt: string;
  completedAt?: string;
  isPreviewMode: boolean;          // True if user is on free preview
}

export interface TourState {
  activeTour: WalkingTour | null;
  progress: TourProgress | null;
  isComplete: boolean;
  previewLimitReached: boolean;
}
