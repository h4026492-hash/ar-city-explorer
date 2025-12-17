import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, tap } from 'rxjs';
import { WalkingTour, TourProgress, TourState } from '../models/walking-tour.model';
import { SubscriptionService } from './subscription.service';
import { AnalyticsService } from './analytics.service';

@Injectable({ providedIn: 'root' })
export class WalkingTourService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private subscriptionService = inject(SubscriptionService);
  private analyticsService = inject(AnalyticsService);

  private readonly PROGRESS_KEY = 'tour_progress';
  
  // Cached tours
  private toursCache = signal<WalkingTour[]>([]);
  
  // Active tour state
  private _activeTour = signal<WalkingTour | null>(null);
  private _progress = signal<TourProgress | null>(null);
  private _previewLimitReached = signal(false);
  
  // Public readonly signals
  readonly activeTour = this._activeTour.asReadonly();
  readonly progress = this._progress.asReadonly();
  readonly previewLimitReached = this._previewLimitReached.asReadonly();

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  constructor() {
    if (this.isBrowser) {
      this.loadSavedProgress();
    }
  }

  // ─────────────────────────────────────────────────────
  // TOUR LOADING
  // ─────────────────────────────────────────────────────

  /**
   * Load tours for a specific city
   */
  getToursByCity(cityId: string): Observable<WalkingTour[]> {
    // Check cache first
    const cached = this.toursCache();
    if (cached.length > 0) {
      return of(cached.filter(t => t.cityId === cityId));
    }

    // Load from JSON
    return this.http.get<{ tours: WalkingTour[] }>(`assets/tours/${cityId}-tours.json`).pipe(
      map(data => data.tours || []),
      tap(tours => this.toursCache.set(tours)),
      catchError(() => of([]))
    );
  }

  /**
   * Get a specific tour by ID
   */
  getTourById(tourId: string): Observable<WalkingTour | null> {
    const cached = this.toursCache();
    const found = cached.find(t => t.id === tourId);
    if (found) {
      return of(found);
    }

    // Try loading Dallas tours (default city)
    return this.getToursByCity('dallas').pipe(
      map(tours => tours.find(t => t.id === tourId) || null)
    );
  }

  /**
   * Get all available tours
   */
  getAllTours(): Observable<WalkingTour[]> {
    return this.getToursByCity('dallas');
  }

  // ─────────────────────────────────────────────────────
  // TOUR PROGRESSION
  // ─────────────────────────────────────────────────────

  /**
   * Start a walking tour
   */
  startTour(tour: WalkingTour): boolean {
    const isPremium = this.subscriptionService.isPremium();
    
    // Check if premium tour and user is free
    if (tour.isPremium && !isPremium) {
      // User can start in preview mode
      this._previewLimitReached.set(false);
    }

    const progress: TourProgress = {
      tourId: tour.id,
      currentLandmarkIndex: 0,
      visitedLandmarkIds: [],
      startedAt: new Date().toISOString(),
      isPreviewMode: tour.isPremium && !isPremium
    };

    this._activeTour.set(tour);
    this._progress.set(progress);
    this.saveProgress();

    this.analyticsService.track('tour_started' as any, {
      tour_id: tour.id,
      is_premium: tour.isPremium,
      is_preview_mode: progress.isPreviewMode
    });

    return true;
  }

  /**
   * Get the next landmark in the tour sequence
   */
  getNextLandmark(): { landmarkId: string; index: number } | null {
    const tour = this._activeTour();
    const progress = this._progress();
    
    if (!tour || !progress) return null;

    const nextIndex = progress.currentLandmarkIndex;
    
    // Check if tour is complete
    if (nextIndex >= tour.landmarkIds.length) {
      return null;
    }

    // Check preview limit for free users
    if (progress.isPreviewMode && nextIndex >= tour.previewLandmarkCount) {
      this._previewLimitReached.set(true);
      
      this.analyticsService.track('tour_preview_completed' as any, {
        tour_id: tour.id,
        landmarks_viewed: nextIndex
      });
      
      return null;
    }

    return {
      landmarkId: tour.landmarkIds[nextIndex],
      index: nextIndex
    };
  }

  /**
   * Mark a landmark as visited and advance to next
   */
  markLandmarkVisited(landmarkId: string): void {
    const tour = this._activeTour();
    const progress = this._progress();
    
    if (!tour || !progress) return;

    // Verify this is the expected landmark
    const expectedId = tour.landmarkIds[progress.currentLandmarkIndex];
    if (expectedId !== landmarkId) return;

    const updatedProgress: TourProgress = {
      ...progress,
      currentLandmarkIndex: progress.currentLandmarkIndex + 1,
      visitedLandmarkIds: [...progress.visitedLandmarkIds, landmarkId]
    };

    // Check if tour is complete
    if (updatedProgress.currentLandmarkIndex >= tour.landmarkIds.length) {
      updatedProgress.completedAt = new Date().toISOString();
      
      this.analyticsService.track('tour_completed' as any, {
        tour_id: tour.id,
        duration_minutes: this.calculateDuration(progress.startedAt)
      });
    }

    this._progress.set(updatedProgress);
    this.saveProgress();
  }

  /**
   * Check if a specific landmark is part of the active tour
   */
  isLandmarkInTour(landmarkId: string): boolean {
    const tour = this._activeTour();
    return tour ? tour.landmarkIds.includes(landmarkId) : false;
  }

  /**
   * Get landmark order in tour (1-based)
   */
  getLandmarkOrder(landmarkId: string): number {
    const tour = this._activeTour();
    if (!tour) return 0;
    
    const index = tour.landmarkIds.indexOf(landmarkId);
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Check if tour is complete
   */
  isTourComplete(): boolean {
    const tour = this._activeTour();
    const progress = this._progress();
    
    if (!tour || !progress) return false;
    return progress.currentLandmarkIndex >= tour.landmarkIds.length;
  }

  /**
   * End the current tour
   */
  endTour(): void {
    const tour = this._activeTour();
    if (tour) {
      this.analyticsService.track('tour_ended' as any, {
        tour_id: tour.id,
        completed: this.isTourComplete()
      });
    }

    this._activeTour.set(null);
    this._progress.set(null);
    this._previewLimitReached.set(false);
    this.clearProgress();
  }

  // ─────────────────────────────────────────────────────
  // PREVIEW & ACCESS CONTROL
  // ─────────────────────────────────────────────────────

  /**
   * Check if user can access full tour
   */
  canAccessFullTour(tour: WalkingTour): boolean {
    if (!tour.isPremium) return true;
    return this.subscriptionService.isPremium();
  }

  /**
   * Get accessible landmark count for a tour
   */
  getAccessibleLandmarkCount(tour: WalkingTour): number {
    if (this.canAccessFullTour(tour)) {
      return tour.landmarkIds.length;
    }
    return tour.previewLandmarkCount;
  }

  /**
   * Upgrade tour from preview to full (after subscription)
   */
  upgradeTourAccess(): void {
    const progress = this._progress();
    if (!progress || !progress.isPreviewMode) return;

    this._progress.set({
      ...progress,
      isPreviewMode: false
    });
    this._previewLimitReached.set(false);
    this.saveProgress();
  }

  // ─────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────

  private loadSavedProgress(): void {
    try {
      const stored = localStorage.getItem(this.PROGRESS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this._progress.set(data.progress);
        
        // Reload the tour
        if (data.progress?.tourId) {
          this.getTourById(data.progress.tourId).subscribe(tour => {
            if (tour) {
              this._activeTour.set(tour);
            }
          });
        }
      }
    } catch {
      // No saved progress
    }
  }

  private saveProgress(): void {
    if (!this.isBrowser) return;
    
    const progress = this._progress();
    if (progress) {
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify({ progress }));
    }
  }

  private clearProgress(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.PROGRESS_KEY);
  }

  private calculateDuration(startedAt: string): number {
    const start = new Date(startedAt);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 60000);
  }
}
