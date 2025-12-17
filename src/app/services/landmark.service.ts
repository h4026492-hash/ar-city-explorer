import { Injectable, inject, signal, effect, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Landmark, LandmarkWithDistance } from '../models/landmark.model';
import { CityService } from './city.service';
import { DemoModeService } from './demo-mode.service';
import { catchError, of, tap } from 'rxjs';

// Import Dallas landmarks as fallback
import dallasLandmarksJson from '../../assets/dallas-landmarks.json';
// Import demo landmarks for investor demo
import * as demoLandmarksData from '../../assets/demo/demo-landmarks.json';

const LOTD_KEY_PREFIX = 'landmark_of_the_day_';

@Injectable({ providedIn: 'root' })
export class LandmarkService {
  private http = inject(HttpClient);
  private cityService = inject(CityService);
  private demoModeService = inject(DemoModeService);
  private platformId = inject(PLATFORM_ID);
  
  private _landmarks = signal<Landmark[]>(dallasLandmarksJson as Landmark[]);
  private _currentCityId = signal<string>('dallas');
  private _isLoading = signal(false);

  // Public readonly signals
  readonly landmarks = this._landmarks.asReadonly();
  readonly currentCityId = this._currentCityId.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    // React to city changes
    effect(() => {
      const activeCity = this.cityService.activeCity();
      if (activeCity && activeCity.id !== this._currentCityId()) {
        this.loadLandmarksForCity(activeCity.id);
      }
    });
    
    // React to demo mode changes
    effect(() => {
      if (this.demoModeService.isDemo()) {
        this.loadDemoLandmarks();
      }
    });
  }

  /**
   * Load demo landmarks for investor presentations
   */
  private loadDemoLandmarks(): void {
    const demoLandmarks = (demoLandmarksData as any).landmarks || demoLandmarksData;
    this._landmarks.set(demoLandmarks as Landmark[]);
    this._currentCityId.set('dallas');
  }

  /**
   * Load landmarks for a specific city
   */
  loadLandmarksForCity(cityId: string): void {
    // Demo mode: always use demo landmarks
    if (this.demoModeService.isDemo()) {
      this.loadDemoLandmarks();
      return;
    }
    
    // Skip if already loaded for this city
    if (cityId === this._currentCityId() && this._landmarks().length > 0) {
      return;
    }

    this._isLoading.set(true);
    
    // Try to load city-specific landmark file
    const url = `/assets/${cityId}-landmarks.json`;
    
    this.http.get<Landmark[]>(url).pipe(
      tap(landmarks => {
        this._landmarks.set(landmarks);
        this._currentCityId.set(cityId);
        this._isLoading.set(false);
      }),
      catchError(error => {
        console.warn(`Failed to load landmarks for ${cityId}:`, error);
        
        // Fall back to Dallas if loading fails
        if (cityId !== 'dallas') {
          this._landmarks.set(dallasLandmarksJson as Landmark[]);
          this._currentCityId.set('dallas');
        }
        this._isLoading.set(false);
        return of([]);
      })
    ).subscribe();
  }

  // Get all landmarks for current city
  getLandmarks(): Landmark[] {
    return this._landmarks();
  }

  // Alias for getLandmarks
  getAllLandmarks(): Landmark[] {
    return this._landmarks();
  }

  // Get a single landmark by ID
  getLandmarkById(id: string): Landmark | undefined {
    return this._landmarks().find(l => l.id === id);
  }

  // Get landmarks sorted by distance from user location
  getNearbyLandmarks(
    userLat: number, 
    userLng: number, 
    maxDistanceMeters?: number
  ): LandmarkWithDistance[] {
    const landmarksWithDistance = this._landmarks().map(landmark => {
      const distance = this.calculateDistance(
        userLat, userLng,
        landmark.lat, landmark.lng
      );
      
      return {
        ...landmark,
        distance,
        formattedDistance: this.formatDistance(distance)
      } as LandmarkWithDistance;
    });

    // Sort by distance
    landmarksWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    // Filter by max distance if provided
    if (maxDistanceMeters) {
      return landmarksWithDistance.filter(l => 
        l.distance !== undefined && l.distance <= maxDistanceMeters
      );
    }

    return landmarksWithDistance;
  }

  // Haversine formula for distance calculation
  private calculateDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Format distance for display
  private formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  }

  // ─────────────────────────────────────────────────────
  // LANDMARK OF THE DAY
  // ─────────────────────────────────────────────────────

  /**
   * Get Landmark of the Day for a city
   * Same landmark is returned for the entire calendar day
   * Persisted in localStorage
   */
  getLandmarkOfTheDay(cityId?: string): Landmark | null {
    const city = cityId || this._currentCityId();
    const today = this.getTodayKey();
    const storageKey = `${LOTD_KEY_PREFIX}${city}_${today}`;
    
    // Check if we already have today's selection
    if (this.isBrowser) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const landmark = this.getLandmarkById(stored);
        if (landmark) return landmark;
      }
    }
    
    // Select a new landmark for today
    const landmarks = this._landmarks();
    if (landmarks.length === 0) return null;
    
    // Use date as seed for consistent daily selection
    const dayNumber = new Date().getDate();
    const monthNumber = new Date().getMonth();
    const seed = dayNumber + (monthNumber * 31);
    const index = seed % landmarks.length;
    const selected = landmarks[index];
    
    // Persist selection
    if (this.isBrowser && selected) {
      // Clean old entries first
      this.cleanOldLotdEntries(city);
      localStorage.setItem(storageKey, selected.id);
    }
    
    return selected || null;
  }

  /**
   * Check if a landmark is today's Landmark of the Day
   */
  isLandmarkOfTheDay(landmarkId: string, cityId?: string): boolean {
    const lotd = this.getLandmarkOfTheDay(cityId);
    return lotd?.id === landmarkId;
  }

  /**
   * Get today's date key (YYYY-MM-DD)
   */
  private getTodayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * Clean old LOTD entries (keep only today's)
   */
  private cleanOldLotdEntries(cityId: string): void {
    if (!this.isBrowser) return;
    
    const today = this.getTodayKey();
    const prefix = `${LOTD_KEY_PREFIX}${cityId}_`;
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && !key.endsWith(today)) {
        localStorage.removeItem(key);
      }
    }
  }
}
