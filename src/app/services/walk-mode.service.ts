import { Injectable, signal, computed, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { InterestService } from './interest.service';
import { AiMemoryService } from './ai-memory.service';
import { CityService } from './city.service';
import { InterestType } from '../models/interest.model';
import { WalkingTour } from '../models/walking-tour.model';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface WalkLandmark {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance?: number;
  tags?: string[];
  matchedInterest?: InterestType;
}

@Injectable({ providedIn: 'root' })
export class WalkModeService {
  private platformId = inject(PLATFORM_ID);
  private interestService = inject(InterestService);
  private memoryService = inject(AiMemoryService);
  private cityService = inject(CityService);
  
  // State
  private _isActive = signal(false);
  private _currentLocation = signal<GeoLocation | null>(null);
  private _pendingLandmark = signal<WalkLandmark | null>(null);
  private _visitedIds = signal<Set<string>>(new Set());
  private _skippedIds = signal<Set<string>>(new Set());
  private _isPaused = signal(false);
  private _gpsAccuracyPoor = signal(false);
  private _currentCityId = signal<string>('dallas');
  
  // Tour mode state
  private _activeTour = signal<WalkingTour | null>(null);
  private _tourIndex = signal(0);
  private _tourPreviewLimit = signal(0);
  private _tourPreviewLimitReached = signal(false);
  
  private watchId: number | null = null;
  
  // Public readonly signals
  readonly isActive = this._isActive.asReadonly();
  readonly currentLocation = this._currentLocation.asReadonly();
  readonly pendingLandmark = this._pendingLandmark.asReadonly();
  readonly isPaused = this._isPaused.asReadonly();
  readonly gpsAccuracyPoor = this._gpsAccuracyPoor.asReadonly();
  
  // Tour signals
  readonly activeTour = this._activeTour.asReadonly();
  readonly tourIndex = this._tourIndex.asReadonly();
  readonly tourPreviewLimitReached = this._tourPreviewLimitReached.asReadonly();

  constructor() {
    // React to city changes - reset walk mode state
    effect(() => {
      const activeCity = this.cityService.activeCity();
      if (activeCity && activeCity.id !== this._currentCityId()) {
        this.onCityChanged(activeCity.id);
      }
    });
  }

  /**
   * Handle city change - reset all walk mode state
   */
  private onCityChanged(newCityId: string): void {
    // Stop any active walk
    if (this._isActive()) {
      this.stopWalk();
    }

    // Reset all state for the new city
    this._visitedIds.set(new Set());
    this._skippedIds.set(new Set());
    this._pendingLandmark.set(null);
    this._activeTour.set(null);
    this._tourIndex.set(0);
    this._tourPreviewLimitReached.set(false);
    this._currentCityId.set(newCityId);
  }
  
  // Threshold for "landmark ahead" prompt (meters)
  readonly PROXIMITY_THRESHOLD = 30;
  readonly POOR_ACCURACY_THRESHOLD = 50;
  // Interest matching gives priority within this distance range
  readonly INTEREST_PRIORITY_RANGE = 200;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Haversine formula for distance calculation
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Calculate interest match score for a landmark
  private getInterestMatchScore(tags?: string[]): { score: number; matchedInterest?: InterestType } {
    if (!tags || tags.length === 0) {
      return { score: 0 };
    }

    const userInterests = this.interestService.getInterests();
    
    for (const interest of userInterests) {
      if (tags.includes(interest)) {
        // Higher score for primary interest (first in list)
        const isPrimary = interest === userInterests[0];
        return { 
          score: isPrimary ? 2 : 1, 
          matchedInterest: interest 
        };
      }
    }
    
    return { score: 0 };
  }

  // Start walk mode and begin watching location
  startWalk(): boolean {
    if (!this.isBrowser || !navigator.geolocation) {
      console.warn('Geolocation not available');
      return false;
    }

    this._isActive.set(true);
    this._isPaused.set(false);
    this._visitedIds.set(new Set());
    this._skippedIds.set(new Set());
    this._pendingLandmark.set(null);

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    return true;
  }

  // Stop walk mode
  stopWalk(): void {
    this._isActive.set(false);
    this._pendingLandmark.set(null);
    
    if (this.watchId !== null && this.isBrowser) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Pause walk mode (e.g., when app goes background)
  pauseWalk(): void {
    this._isPaused.set(true);
  }

  // Resume walk mode
  resumeWalk(): void {
    this._isPaused.set(false);
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    const location: GeoLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };

    this._currentLocation.set(location);

    // Check GPS accuracy
    if (location.accuracy > this.POOR_ACCURACY_THRESHOLD) {
      this._gpsAccuracyPoor.set(true);
      this._isPaused.set(true);
    } else {
      this._gpsAccuracyPoor.set(false);
      if (this._isPaused()) {
        this._isPaused.set(false);
      }
    }
  }

  private handlePositionError(error: GeolocationPositionError): void {
    console.error('GPS Error:', error.message);
    this._gpsAccuracyPoor.set(true);
    this._isPaused.set(true);
  }

  // Get the nearest unvisited landmark
  getNextLandmark(landmarks: WalkLandmark[]): WalkLandmark | null {
    const location = this._currentLocation();
    if (!location) return null;

    const visited = this._visitedIds();
    const skipped = this._skippedIds();

    // Filter out visited and skipped landmarks
    const available = landmarks.filter(
      (l) => !visited.has(l.id) && !skipped.has(l.id)
    );

    if (available.length === 0) return null;

    // Calculate distances and interest scores
    const withScores = available.map((landmark) => {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        landmark.latitude,
        landmark.longitude
      );
      const { score, matchedInterest } = this.getInterestMatchScore(landmark.tags);
      
      // Check if previously visited across sessions (AI memory)
      const hasMemory = this.memoryService.hasMemory(landmark.id);
      
      return {
        ...landmark,
        distance,
        matchedInterest,
        interestScore: score,
        previouslyVisited: hasMemory
      };
    });

    // Sort by: 
    // 1. Deprioritize previously visited landmarks (across sessions)
    // 2. If within priority range, prefer interest matches
    // 3. Otherwise, sort by distance
    withScores.sort((a, b) => {
      // Previously visited landmarks go to the end
      if (a.previouslyVisited && !b.previouslyVisited) return 1;
      if (!a.previouslyVisited && b.previouslyVisited) return -1;
      
      const aInRange = (a.distance || 0) <= this.INTEREST_PRIORITY_RANGE;
      const bInRange = (b.distance || 0) <= this.INTEREST_PRIORITY_RANGE;
      
      // Both in priority range - prefer higher interest score
      if (aInRange && bInRange) {
        const scoreDiff = (b.interestScore || 0) - (a.interestScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
      }
      
      // Fall back to distance
      return (a.distance || 0) - (b.distance || 0);
    });

    return withScores[0];
  }

  // Check if any landmark is within proximity
  checkProximity(landmarks: WalkLandmark[]): WalkLandmark | null {
    if (this._isPaused() || this._pendingLandmark()) return null;

    const nearest = this.getNextLandmark(landmarks);
    if (!nearest || !nearest.distance) return null;

    if (nearest.distance <= this.PROXIMITY_THRESHOLD) {
      this._pendingLandmark.set(nearest);
      return nearest;
    }

    return null;
  }

  // User chose to explore the pending landmark
  explorePending(): WalkLandmark | null {
    const pending = this._pendingLandmark();
    if (!pending) return null;

    this.markVisited(pending.id);
    this._pendingLandmark.set(null);
    return pending;
  }

  // User chose to skip the pending landmark
  skipPending(): void {
    const pending = this._pendingLandmark();
    if (pending) {
      this._skippedIds.update((set) => new Set([...set, pending.id]));
      this._pendingLandmark.set(null);
    }
  }

  // Mark a landmark as visited
  markVisited(id: string): void {
    this._visitedIds.update((set) => new Set([...set, id]));
    
    // If in tour mode, advance the tour index
    if (this._activeTour()) {
      this.advanceTour(id);
    }
  }

  // Check if landmark was visited
  hasVisited(id: string): boolean {
    return this._visitedIds().has(id);
  }

  // Get count of visited landmarks
  getVisitedCount(): number {
    return this._visitedIds().size;
  }

  // Get distance to a specific landmark
  getDistanceTo(landmark: WalkLandmark): number | null {
    const location = this._currentLocation();
    if (!location) return null;

    return this.calculateDistance(
      location.latitude,
      location.longitude,
      landmark.latitude,
      landmark.longitude
    );
  }

  // Format distance for display
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  // ─────────────────────────────────────────────────────
  // TOUR MODE
  // ─────────────────────────────────────────────────────

  /**
   * Start walk mode with a specific tour
   */
  startTourWalk(tour: WalkingTour, isPreviewMode: boolean): boolean {
    this._activeTour.set(tour);
    this._tourIndex.set(0);
    this._tourPreviewLimitReached.set(false);
    
    // Set preview limit
    if (isPreviewMode) {
      this._tourPreviewLimit.set(tour.previewLandmarkCount);
    } else {
      this._tourPreviewLimit.set(tour.landmarkIds.length); // No limit
    }
    
    // Start regular walk mode
    return this.startWalk();
  }

  /**
   * Get next landmark in tour sequence
   */
  getNextTourLandmark(landmarks: WalkLandmark[]): WalkLandmark | null {
    const tour = this._activeTour();
    if (!tour) return null;

    const currentIndex = this._tourIndex();
    
    // Check if tour is complete
    if (currentIndex >= tour.landmarkIds.length) {
      return null;
    }

    // Check preview limit
    if (currentIndex >= this._tourPreviewLimit()) {
      this._tourPreviewLimitReached.set(true);
      return null;
    }

    // Get the specific landmark for this tour stop
    const targetId = tour.landmarkIds[currentIndex];
    return landmarks.find(l => l.id === targetId) || null;
  }

  /**
   * Advance to next tour stop
   */
  private advanceTour(landmarkId: string): void {
    const tour = this._activeTour();
    if (!tour) return;

    const currentIndex = this._tourIndex();
    const expectedId = tour.landmarkIds[currentIndex];
    
    // Only advance if this is the expected landmark
    if (landmarkId === expectedId) {
      this._tourIndex.set(currentIndex + 1);
    }
  }

  /**
   * Check if tour is complete
   */
  isTourComplete(): boolean {
    const tour = this._activeTour();
    if (!tour) return false;
    return this._tourIndex() >= tour.landmarkIds.length;
  }

  /**
   * Get current tour progress
   */
  getTourProgress(): { current: number; total: number } | null {
    const tour = this._activeTour();
    if (!tour) return null;
    
    return {
      current: this._tourIndex(),
      total: tour.landmarkIds.length
    };
  }

  /**
   * Check if currently in tour mode
   */
  isInTourMode(): boolean {
    return this._activeTour() !== null;
  }

  /**
   * End tour mode (resets tour state)
   */
  endTourMode(): void {
    this._activeTour.set(null);
    this._tourIndex.set(0);
    this._tourPreviewLimit.set(0);
    this._tourPreviewLimitReached.set(false);
  }

  /**
   * Upgrade from preview to full tour (after subscription)
   */
  upgradeTourAccess(): void {
    const tour = this._activeTour();
    if (!tour) return;
    
    this._tourPreviewLimit.set(tour.landmarkIds.length);
    this._tourPreviewLimitReached.set(false);
  }
}
