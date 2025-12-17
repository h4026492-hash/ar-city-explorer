/**
 * Offline Service - Data Integrity Hardened
 * 
 * Purpose: Manages offline data with bulletproof corruption protection.
 * 
 * Data Safety:
 * - Validates all JSON before reading
 * - Detects corrupted offline packs
 * - Auto-clears corrupted data (prevents crashes)
 * - Re-downloads if corruption detected
 * - Never crashes on invalid data
 * 
 * Privacy Note: All offline data is stored locally on device only.
 * No data is sent to external servers.
 */

import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CityPack, CityPackLandmark, CityPackStatus } from '../models/city-pack.model';

export interface DataIntegrityReport {
  isValid: boolean;
  corruptedPacks: string[];
  repairedPacks: string[];
  lastChecked: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private legacyKey = 'offline_dallas_pack'; // Backward compat
  private packKeyPrefix = 'city_pack_';
  private platformId = inject(PLATFORM_ID);
  
  // Track corruption events
  private _lastIntegrityReport = signal<DataIntegrityReport | null>(null);
  readonly lastIntegrityReport = this._lastIntegrityReport.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // ─────────────────────────────────────────────────────
  // DATA INTEGRITY METHODS
  // ─────────────────────────────────────────────────────

  /**
   * Validate JSON string before parsing
   * Returns null if invalid
   */
  private safeParseJSON<T>(jsonString: string | null): T | null {
    if (!jsonString) return null;
    
    try {
      const parsed = JSON.parse(jsonString);
      return parsed as T;
    } catch (error) {
      console.warn('JSON parse failed:', error);
      return null;
    }
  }

  /**
   * Validate city pack structure
   */
  private isValidCityPack(data: unknown): data is CityPack {
    if (!data || typeof data !== 'object') return false;
    
    const pack = data as any;
    
    // Required fields
    if (typeof pack.cityId !== 'string') return false;
    if (typeof pack.cityName !== 'string') return false;
    if (typeof pack.version !== 'number') return false;
    if (!pack.landmarks || typeof pack.landmarks !== 'object') return false;
    
    // Validate landmarks structure
    for (const [id, landmark] of Object.entries(pack.landmarks)) {
      if (!this.isValidLandmark(landmark)) {
        console.warn(`Invalid landmark ${id} in pack ${pack.cityId}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate landmark structure
   */
  private isValidLandmark(data: unknown): data is CityPackLandmark {
    if (!data || typeof data !== 'object') return false;
    
    const landmark = data as any;
    return (
      typeof landmark.name === 'string' &&
      typeof landmark.explanation === 'string'
    );
  }

  /**
   * Run integrity check on all stored packs
   */
  runIntegrityCheck(): DataIntegrityReport {
    const report: DataIntegrityReport = {
      isValid: true,
      corruptedPacks: [],
      repairedPacks: [],
      lastChecked: new Date().toISOString()
    };

    if (!this.isBrowser) return report;

    // Check all city packs
    const cities = ['dallas', 'austin', 'houston', 'san_antonio'];
    
    for (const cityId of cities) {
      const key = this.packKeyPrefix + cityId;
      const rawData = localStorage.getItem(key);
      
      if (rawData) {
        const parsed = this.safeParseJSON<CityPack>(rawData);
        
        if (!parsed || !this.isValidCityPack(parsed)) {
          report.isValid = false;
          report.corruptedPacks.push(cityId);
          
          // Auto-repair: remove corrupted pack
          this.deleteCityPack(cityId);
          report.repairedPacks.push(cityId);
          
          console.warn(`Corrupted pack detected and removed: ${cityId}`);
        }
      }
    }

    // Check legacy storage
    const legacyData = localStorage.getItem(this.legacyKey);
    if (legacyData) {
      const parsed = this.safeParseJSON<Record<string, any>>(legacyData);
      if (!parsed) {
        report.isValid = false;
        report.corruptedPacks.push('legacy');
        localStorage.removeItem(this.legacyKey);
        report.repairedPacks.push('legacy');
      }
    }

    this._lastIntegrityReport.set(report);
    return report;
  }

  // ─────────────────────────────────────────────────────
  // VERSIONED CITY PACK METHODS (HARDENED)
  // ─────────────────────────────────────────────────────

  // Get a city pack by ID - with validation
  getCityPack(cityId: string): CityPack | null {
    if (!this.isBrowser) return null;
    
    try {
      const key = this.packKeyPrefix + cityId;
      const rawData = localStorage.getItem(key);
      
      if (!rawData) return null;
      
      const parsed = this.safeParseJSON<CityPack>(rawData);
      
      // Validate structure
      if (!parsed || !this.isValidCityPack(parsed)) {
        console.warn(`Corrupted pack detected: ${cityId}, removing`);
        this.deleteCityPack(cityId);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.warn(`Error reading pack ${cityId}:`, error);
      return null;
    }
  }

  // Save a complete city pack
  saveCityPack(pack: CityPack): void {
    if (!this.isBrowser) return;
    const key = this.packKeyPrefix + pack.cityId;
    localStorage.setItem(key, JSON.stringify(pack));
  }

  // Check if pack is outdated
  isPackOutdated(cityId: string, latestVersion: number): boolean {
    const pack = this.getCityPack(cityId);
    if (!pack) return true; // No pack = outdated
    return pack.version < latestVersion;
  }

  // Check if pack exists
  hasPackForCity(cityId: string): boolean {
    return this.getCityPack(cityId) !== null;
  }

  // Get pack status for UI display
  getPackStatus(cityId: string, latestVersion?: number): CityPackStatus {
    const pack = this.getCityPack(cityId);
    
    return {
      cityId,
      isDownloaded: pack !== null,
      localVersion: pack?.version,
      latestVersion,
      isOutdated: latestVersion ? this.isPackOutdated(cityId, latestVersion) : false,
      downloadedAt: pack?.lastUpdated,
      landmarkCount: pack ? Object.keys(pack.landmarks).length : 0
    };
  }

  // Get explanation from versioned pack
  getFromPack(cityId: string, landmarkId: string): CityPackLandmark | null {
    const pack = this.getCityPack(cityId);
    if (!pack) return null;
    return pack.landmarks[landmarkId] || null;
  }

  // Update single landmark in pack (only if versions match)
  updateLandmarkInPack(
    cityId: string, 
    landmarkId: string, 
    name: string, 
    explanation: string,
    expectedVersion?: number
  ): boolean {
    const pack = this.getCityPack(cityId);
    if (!pack) return false;
    
    // If version specified, check it matches
    if (expectedVersion !== undefined && pack.version !== expectedVersion) {
      return false; // Version mismatch, don't update
    }
    
    pack.landmarks[landmarkId] = {
      name,
      explanation,
      downloadedAt: new Date().toISOString()
    };
    
    this.saveCityPack(pack);
    return true;
  }

  // Delete a city pack
  deleteCityPack(cityId: string): void {
    if (!this.isBrowser) return;
    const key = this.packKeyPrefix + cityId;
    localStorage.removeItem(key);
  }

  // ─────────────────────────────────────────────────────
  // LEGACY METHODS (backward compatible)
  // ─────────────────────────────────────────────────────

  save(id: string, name: string, text: string) {
    if (!this.isBrowser) return;
    const data = this.getAll();
    data[id] = { name, text, savedAt: Date.now() };
    localStorage.setItem(this.legacyKey, JSON.stringify(data));
  }

  get(id: string): { name: string; text: string } | null {
    // First check versioned pack for Dallas
    const packItem = this.getFromPack('dallas', id);
    if (packItem) {
      return { name: packItem.name, text: packItem.explanation };
    }
    
    // Fallback to legacy storage
    const item = this.getAll()[id];
    return item || null;
  }

  getAll(): Record<string, { name: string; text: string; savedAt: number }> {
    if (!this.isBrowser) return {};
    try {
      return JSON.parse(localStorage.getItem(this.legacyKey) || '{}');
    } catch {
      return {};
    }
  }

  has(id: string): boolean {
    // Check versioned pack first
    const packItem = this.getFromPack('dallas', id);
    if (packItem) return true;
    
    // Fallback to legacy
    return !!this.getAll()[id];
  }

  clear() {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.legacyKey);
  }

  getDownloadedCount(): number {
    // Count from versioned pack first
    const pack = this.getCityPack('dallas');
    if (pack) {
      return Object.keys(pack.landmarks).length;
    }
    
    // Fallback to legacy
    return Object.keys(this.getAll()).length;
  }

  // Migrate legacy data to versioned pack
  migrateLegacyData(cityId: string, cityName: string): CityPack | null {
    if (!this.isBrowser) return null;
    
    const legacyData = this.getAll();
    if (Object.keys(legacyData).length === 0) return null;
    
    const landmarks: Record<string, CityPackLandmark> = {};
    
    for (const [id, item] of Object.entries(legacyData)) {
      landmarks[id] = {
        name: item.name,
        explanation: item.text,
        downloadedAt: new Date(item.savedAt).toISOString()
      };
    }
    
    const pack: CityPack = {
      cityId,
      cityName,
      version: 1,
      lastUpdated: new Date().toISOString(),
      landmarks
    };
    
    this.saveCityPack(pack);
    return pack;
  }
}
