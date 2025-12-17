/**
 * Location Service
 * 
 * Purpose: Handles device location with graceful permission handling.
 * App continues to work even if location is denied - just without
 * distance-based features.
 * 
 * Demo Mode: Returns fixed Dallas downtown coordinates.
 * 
 * Privacy Note: Location is used only for calculating distances to
 * landmarks and is never sent to external servers. All processing
 * happens on-device.
 * 
 * App Store Compliance: Location permission is OPTIONAL. Users can
 * enjoy the app in browse mode without granting location access.
 */

import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DemoModeService } from './demo-mode.service';

export type LocationPermissionStatus = 
  | 'unknown'      // Not yet requested
  | 'granted'      // User allowed
  | 'denied'       // User denied
  | 'unavailable'  // Device doesn't support
  | 'error';       // Something went wrong

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private platformId = inject(PLATFORM_ID);
  private demoModeService = inject(DemoModeService);
  
  // Reactive state
  private _permissionStatus = signal<LocationPermissionStatus>('unknown');
  private _currentLocation = signal<UserLocation | null>(null);
  private _isTracking = signal(false);
  private _lastError = signal<string | null>(null);
  
  // Public readonly signals
  readonly permissionStatus = this._permissionStatus.asReadonly();
  readonly currentLocation = this._currentLocation.asReadonly();
  readonly isTracking = this._isTracking.asReadonly();
  readonly lastError = this._lastError.asReadonly();
  
  // Geolocation watch ID
  private watchId: number | null = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Check if location services are available on this device
   * Demo mode always returns true
   */
  isLocationAvailable(): boolean {
    if (this.demoModeService.isDemo()) return true;
    if (!this.isBrowser) return false;
    return 'geolocation' in navigator;
  }

  /**
   * Check if we can use distance-based features
   * Demo mode always returns true
   */
  canUseDistanceFeatures(): boolean {
    if (this.demoModeService.isDemo()) return true;
    return this._permissionStatus() === 'granted' && this._currentLocation() !== null;
  }

  /**
   * Request location permission and start tracking
   * Demo mode returns instant success with fixed location
   */
  async requestPermission(): Promise<boolean> {
    // Demo mode: return fixed Dallas location immediately
    if (this.demoModeService.isDemo()) {
      const demoLoc = this.demoModeService.demoLocation;
      this._permissionStatus.set('granted');
      this._currentLocation.set({
        latitude: demoLoc.latitude,
        longitude: demoLoc.longitude,
        accuracy: demoLoc.accuracy,
        timestamp: Date.now()
      });
      return true;
    }
    
    if (!this.isBrowser) {
      this._permissionStatus.set('unavailable');
      return false;
    }

    if (!this.isLocationAvailable()) {
      this._permissionStatus.set('unavailable');
      this._lastError.set('Location services are not available on this device');
      return false;
    }

    try {
      // Try to get current position - this triggers permission prompt
      const position = await this.getCurrentPosition();
      
      if (position) {
        this._permissionStatus.set('granted');
        this._currentLocation.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        return true;
      }
      
      return false;
    } catch (error) {
      this.handleLocationError(error);
      return false;
    }
  }

  /**
   * Get current position once (with timeout)
   * Demo mode returns fixed location
   */
  private getCurrentPosition(): Promise<GeolocationPosition | null> {
    // Demo mode: return fake position
    if (this.demoModeService.isDemo()) {
      const demoLoc = this.demoModeService.demoLocation;
      return Promise.resolve({
        coords: {
          latitude: demoLoc.latitude,
          longitude: demoLoc.longitude,
          accuracy: demoLoc.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition);
    }
    
    return new Promise((resolve, reject) => {
      if (!this.isBrowser || !this.isLocationAvailable()) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,    // 10 second timeout
          maximumAge: 60000  // Accept 1-minute old cache
        }
      );
    });
  }

  /**
   * Start continuous location tracking
   * Demo mode sets fixed location once
   */
  startTracking(): void {
    // Demo mode: set fixed location, no real tracking
    if (this.demoModeService.isDemo()) {
      const demoLoc = this.demoModeService.demoLocation;
      this._permissionStatus.set('granted');
      this._currentLocation.set({
        latitude: demoLoc.latitude,
        longitude: demoLoc.longitude,
        accuracy: demoLoc.accuracy,
        timestamp: Date.now()
      });
      this._isTracking.set(true);
      return;
    }
    
    if (!this.isBrowser || !this.isLocationAvailable()) {
      return;
    }

    if (this._isTracking()) {
      return; // Already tracking
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this._permissionStatus.set('granted');
        this._currentLocation.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        this._lastError.set(null);
      },
      (error) => {
        this.handleLocationError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    this._isTracking.set(true);
  }

  /**
   * Stop location tracking
   */
  stopTracking(): void {
    if (this.watchId !== null && this.isBrowser) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this._isTracking.set(false);
  }

  /**
   * Calculate distance between two points (in meters)
   */
  calculateDistance(
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Get distance to a landmark (returns null if location unavailable)
   */
  getDistanceToLandmark(lat: number, lng: number): number | null {
    const location = this._currentLocation();
    if (!location) return null;

    return this.calculateDistance(
      location.latitude,
      location.longitude,
      lat,
      lng
    );
  }

  /**
   * Handle geolocation errors gracefully
   */
  private handleLocationError(error: unknown): void {
    if (error instanceof GeolocationPositionError) {
      switch (error.code) {
        case GeolocationPositionError.PERMISSION_DENIED:
          this._permissionStatus.set('denied');
          this._lastError.set(
            'Location access was denied. You can still browse landmarks, ' +
            'but distance features will be disabled.'
          );
          break;
        case GeolocationPositionError.POSITION_UNAVAILABLE:
          this._permissionStatus.set('error');
          this._lastError.set(
            'Unable to determine your location. Please try again later.'
          );
          break;
        case GeolocationPositionError.TIMEOUT:
          this._permissionStatus.set('error');
          this._lastError.set(
            'Location request timed out. Please check your connection.'
          );
          break;
        default:
          this._permissionStatus.set('error');
          this._lastError.set('An error occurred while getting location.');
      }
    } else {
      this._permissionStatus.set('error');
      this._lastError.set('Location services encountered an error.');
    }
  }

  /**
   * Get user-friendly explanation for current permission status
   */
  getPermissionExplanation(): string {
    switch (this._permissionStatus()) {
      case 'unknown':
        return 'Tap to enable location for distance features';
      case 'granted':
        return 'Location active';
      case 'denied':
        return 'Location disabled - browse mode only';
      case 'unavailable':
        return 'Location not available on this device';
      case 'error':
        return this._lastError() || 'Location error';
    }
  }
}
