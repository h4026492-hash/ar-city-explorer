import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { City } from '../models/city.model';
import { Observable, of, tap, catchError, map } from 'rxjs';
import { environment } from '../../environments/environment';

const ACTIVE_CITY_KEY = 'ar_city_explorer_active_city';
const DEFAULT_CITY_ID = 'dallas';

/**
 * City Service
 * 
 * Manages multi-city state and selection.
 * 
 * Demo Mode: When environment.demoMode is true:
 * - Auto-selects Dallas
 * - Skips persistence (fresh start each launch)
 * - Ideal for investor demos and trade shows
 */
@Injectable({
  providedIn: 'root'
})
export class CityService {
  private _cities = signal<City[]>([]);
  private _activeCityId = signal<string>(DEFAULT_CITY_ID);
  private _isLoaded = signal(false);

  // Public readonly signals
  readonly cities = this._cities.asReadonly();
  readonly activeCityId = this._activeCityId.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();

  // Computed active city
  readonly activeCity = computed(() => {
    const cities = this._cities();
    const activeId = this._activeCityId();
    return cities.find(c => c.id === activeId) || null;
  });

  // Available cities only
  readonly availableCities = computed(() => {
    return this._cities().filter(c => c.isAvailable);
  });

  // Coming soon cities
  readonly comingSoonCities = computed(() => {
    return this._cities().filter(c => !c.isAvailable);
  });

  constructor(private http: HttpClient) {
    // In demo mode, always start with Dallas (no persistence)
    if (!environment.demoMode) {
      this.loadPersistedCity();
    }
  }

  /**
   * Load cities from JSON
   */
  loadCities(): Observable<City[]> {
    if (this._isLoaded()) {
      return of(this._cities());
    }

    return this.http.get<{ cities: City[] }>('/assets/cities.json').pipe(
      map(response => response.cities),
      tap(cities => {
        this._cities.set(cities);
        this._isLoaded.set(true);
        
        // Validate active city still exists
        const activeCity = cities.find(c => c.id === this._activeCityId());
        if (!activeCity || !activeCity.isAvailable) {
          // Fall back to first available city
          const defaultCity = cities.find(c => c.isAvailable);
          if (defaultCity) {
            this.setActiveCity(defaultCity.id);
          }
        }
      }),
      catchError(error => {
        console.error('Failed to load cities:', error);
        // Return Dallas as fallback
        const fallback: City[] = [{
          id: 'dallas',
          name: 'Dallas',
          country: 'USA',
          centerLat: 32.7767,
          centerLng: -96.7970,
          isAvailable: true,
          isPremium: false
        }];
        this._cities.set(fallback);
        this._isLoaded.set(true);
        return of(fallback);
      })
    );
  }

  /**
   * Get all cities
   */
  getCities(): City[] {
    return this._cities();
  }

  /**
   * Get city by ID
   */
  getCityById(id: string): City | undefined {
    return this._cities().find(c => c.id === id);
  }

  /**
   * Get currently active city
   */
  getActiveCity(): City | null {
    return this.activeCity();
  }

  /**
   * Set active city by ID
   * Returns true if successful, false if city not available
   * Demo mode: Always force Dallas, reject other cities
   */
  setActiveCity(cityId: string): boolean {
    // Demo mode: force Dallas, prevent other cities
    if (environment.demoMode && cityId !== 'dallas') {
      console.log('[Demo Mode] City locked to Dallas');
      return false;
    }
    
    const city = this.getCityById(cityId);
    
    if (!city) {
      console.warn(`City not found: ${cityId}`);
      return false;
    }

    if (!city.isAvailable) {
      console.warn(`City not available: ${cityId}`);
      return false;
    }

    this._activeCityId.set(cityId);
    
    // In demo mode, don't persist city choice (fresh start each time)
    if (!environment.demoMode) {
      this.persistActiveCity(cityId);
    }
    return true;
  }

  /**
   * Check if a city can be selected (available + premium check)
   */
  canSelectCity(cityId: string, isPremiumUser: boolean): { allowed: boolean; reason?: string } {
    const city = this.getCityById(cityId);
    
    if (!city) {
      return { allowed: false, reason: 'City not found' };
    }

    if (!city.isAvailable) {
      return { allowed: false, reason: 'Coming soon' };
    }

    if (city.isPremium && !isPremiumUser) {
      return { allowed: false, reason: 'Premium required' };
    }

    return { allowed: true };
  }

  /**
   * Load persisted city from localStorage
   */
  private loadPersistedCity(): void {
    try {
      const stored = localStorage.getItem(ACTIVE_CITY_KEY);
      if (stored) {
        this._activeCityId.set(stored);
      }
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Persist active city to localStorage
   */
  private persistActiveCity(cityId: string): void {
    try {
      localStorage.setItem(ACTIVE_CITY_KEY, cityId);
    } catch (e) {
      // localStorage not available
    }
  }
}
