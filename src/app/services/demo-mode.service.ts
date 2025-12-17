/**
 * Demo Mode Service
 * 
 * Purpose: Controls investor demo mode for showcasing the app.
 * 
 * Demo Mode Features:
 * - Fixed Dallas location (no GPS needed)
 * - Premium unlocked (no payments)
 * - Pre-generated AI explanations (no API calls)
 * - Analytics disabled (clean demo)
 * 
 * Usage:
 * - Tap version label 5x to toggle demo mode
 * - Or set DEMO_MODE=true in environment
 */

import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

const DEMO_MODE_KEY = 'ar_city_demo_mode';

@Injectable({ providedIn: 'root' })
export class DemoModeService {
  private platformId = inject(PLATFORM_ID);
  
  private _isDemo = signal(false);
  readonly isDemoMode = this._isDemo.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    this.initialize();
  }

  /**
   * Initialize demo mode from environment or localStorage
   */
  private initialize(): void {
    // Check environment flag first
    if (environment.demoMode) {
      this._isDemo.set(true);
      return;
    }
    
    // Check localStorage for manual toggle
    if (this.isBrowser) {
      const stored = localStorage.getItem(DEMO_MODE_KEY);
      if (stored === 'true') {
        this._isDemo.set(true);
      }
    }
  }

  /**
   * Check if demo mode is active
   */
  isDemo(): boolean {
    return this._isDemo();
  }

  /**
   * Enable demo mode
   */
  enableDemo(): void {
    this._isDemo.set(true);
    if (this.isBrowser) {
      localStorage.setItem(DEMO_MODE_KEY, 'true');
    }
  }

  /**
   * Disable demo mode
   */
  disableDemo(): void {
    this._isDemo.set(false);
    if (this.isBrowser) {
      localStorage.removeItem(DEMO_MODE_KEY);
    }
  }

  /**
   * Toggle demo mode
   */
  toggleDemo(): boolean {
    if (this._isDemo()) {
      this.disableDemo();
    } else {
      this.enableDemo();
    }
    return this._isDemo();
  }

  // Secret trigger state
  private tapCount = 0;
  private lastTapTime = 0;
  private readonly TAP_THRESHOLD_MS = 3000; // 3 seconds to complete 5 taps
  private readonly TAPS_REQUIRED = 5;

  /**
   * Check for secret 5-tap trigger
   * Returns true if demo mode was activated
   */
  checkSecretTrigger(): boolean {
    const now = Date.now();
    
    // Reset if too much time has passed
    if (now - this.lastTapTime > this.TAP_THRESHOLD_MS) {
      this.tapCount = 0;
    }
    
    this.lastTapTime = now;
    this.tapCount++;
    
    if (this.tapCount >= this.TAPS_REQUIRED) {
      this.tapCount = 0;
      this.enableDemo();
      return true;
    }
    
    return false;
  }

  // Demo location: Downtown Dallas near Reunion Tower
  readonly demoLocation = {
    latitude: 32.7767,
    longitude: -96.8080,
    accuracy: 10
  };
}
