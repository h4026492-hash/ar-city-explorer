import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, of, forkJoin, catchError, map, tap, switchMap } from 'rxjs';
import { CityPack, CityPackManifest, CityPackStatus, CityPackLandmark } from '../models/city-pack.model';
import { OfflineService } from './offline.service';
import { LandmarkService } from './landmark.service';
import { AIService } from './ai.service';

@Injectable({ providedIn: 'root' })
export class CityPackService {
  private platformId = inject(PLATFORM_ID);
  private offlineService = inject(OfflineService);
  private landmarkService = inject(LandmarkService);
  private aiService = inject(AIService);

  // Download progress tracking
  private _isDownloading = signal(false);
  private _downloadProgress = signal(0);
  private _downloadError = signal<string | null>(null);
  
  readonly isDownloading = this._isDownloading.asReadonly();
  readonly downloadProgress = this._downloadProgress.asReadonly();
  readonly downloadError = this._downloadError.asReadonly();

  // Cached manifests
  private manifestCache: Record<string, CityPackManifest> = {};

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // ─────────────────────────────────────────────────────
  // MANIFEST LOADING
  // ─────────────────────────────────────────────────────

  // Load manifest for a city
  loadManifest(cityId: string): Observable<CityPackManifest | null> {
    // Return cached if available
    if (this.manifestCache[cityId]) {
      return of(this.manifestCache[cityId]);
    }

    // Dynamic import of manifest
    return from(
      import(`../../assets/city-packs/${cityId}.manifest.json`)
    ).pipe(
      map(module => module.default as CityPackManifest),
      tap(manifest => {
        this.manifestCache[cityId] = manifest;
      }),
      catchError(() => of(null))
    );
  }

  // Get cached manifest (sync)
  getCachedManifest(cityId: string): CityPackManifest | null {
    return this.manifestCache[cityId] || null;
  }

  // ─────────────────────────────────────────────────────
  // PACK STATUS
  // ─────────────────────────────────────────────────────

  // Check if local pack exists
  hasOfflinePack(cityId: string): boolean {
    return this.offlineService.hasPackForCity(cityId);
  }

  // Get pack status with version comparison
  getPackStatus(cityId: string): Observable<CityPackStatus> {
    return this.loadManifest(cityId).pipe(
      map(manifest => {
        return this.offlineService.getPackStatus(
          cityId, 
          manifest?.latestVersion
        );
      })
    );
  }

  // Check if pack needs update
  isPackOutdated(cityId: string): Observable<boolean> {
    return this.loadManifest(cityId).pipe(
      map(manifest => {
        if (!manifest) return false;
        return this.offlineService.isPackOutdated(cityId, manifest.latestVersion);
      })
    );
  }

  // ─────────────────────────────────────────────────────
  // PACK DOWNLOAD
  // ─────────────────────────────────────────────────────

  // Download complete city pack
  downloadCityPack(cityId: string): Observable<CityPack | null> {
    if (this._isDownloading()) {
      return of(null); // Already downloading
    }

    this._isDownloading.set(true);
    this._downloadProgress.set(0);
    this._downloadError.set(null);

    return this.loadManifest(cityId).pipe(
      switchMap(manifest => {
        if (!manifest) {
          this._downloadError.set('City pack not available');
          this._isDownloading.set(false);
          return of(null);
        }

        // Get landmarks for this city
        const landmarks = this.landmarkService.getAllLandmarks();
        const totalLandmarks = landmarks.length;
        
        if (totalLandmarks === 0) {
          this._downloadError.set('No landmarks found');
          this._isDownloading.set(false);
          return of(null);
        }

        // Create download tasks for each landmark
        const downloadTasks = landmarks.map((landmark, index) => 
          this.aiService.explainLandmark(landmark.id, landmark.name).pipe(
            tap(() => {
              // Update progress
              const progress = Math.round(((index + 1) / totalLandmarks) * 100);
              this._downloadProgress.set(progress);
            }),
            map(explanation => ({
              id: landmark.id,
              name: explanation.name,
              explanation: explanation.text
            })),
            catchError(() => of({
              id: landmark.id,
              name: landmark.name,
              explanation: '' // Mark as failed
            }))
          )
        );

        // Execute all downloads and build pack
        return forkJoin(downloadTasks).pipe(
          map(results => {
            // Build landmarks record
            const landmarksRecord: Record<string, CityPackLandmark> = {};
            let successCount = 0;

            for (const result of results) {
              if (result.explanation) {
                landmarksRecord[result.id] = {
                  name: result.name,
                  explanation: result.explanation,
                  downloadedAt: new Date().toISOString()
                };
                successCount++;
              }
            }

            // Only save if we got at least some landmarks
            if (successCount === 0) {
              this._downloadError.set('Failed to download landmarks');
              this._isDownloading.set(false);
              return null;
            }

            // Create and save pack atomically
            const pack: CityPack = {
              cityId: manifest.cityId,
              cityName: manifest.cityName,
              version: manifest.latestVersion,
              lastUpdated: new Date().toISOString(),
              landmarks: landmarksRecord
            };

            this.offlineService.saveCityPack(pack);
            this._isDownloading.set(false);
            this._downloadProgress.set(100);

            return pack;
          }),
          catchError(error => {
            this._downloadError.set('Download failed');
            this._isDownloading.set(false);
            return of(null);
          })
        );
      })
    );
  }

  // Update existing pack to new version
  updateCityPack(cityId: string): Observable<CityPack | null> {
    // Delete old pack first, then download fresh
    this.offlineService.deleteCityPack(cityId);
    return this.downloadCityPack(cityId);
  }

  // ─────────────────────────────────────────────────────
  // PACK ACCESS
  // ─────────────────────────────────────────────────────

  // Get explanation from pack
  getExplanation(cityId: string, landmarkId: string): CityPackLandmark | null {
    return this.offlineService.getFromPack(cityId, landmarkId);
  }

  // Get current pack version
  getLocalVersion(cityId: string): number | null {
    const pack = this.offlineService.getCityPack(cityId);
    return pack?.version || null;
  }

  // ─────────────────────────────────────────────────────
  // MIGRATION
  // ─────────────────────────────────────────────────────

  // Migrate legacy cached data to versioned pack
  migrateLegacyData(cityId: string): Observable<CityPack | null> {
    return this.loadManifest(cityId).pipe(
      map(manifest => {
        if (!manifest) return null;
        return this.offlineService.migrateLegacyData(cityId, manifest.cityName);
      })
    );
  }
}
