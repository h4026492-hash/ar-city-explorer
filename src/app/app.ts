/**
 * App Component - Launch Day Hardened
 * 
 * Purpose: Main application component with safe startup sequence.
 * 
 * Safety Features:
 * - Services initialized in safe order
 * - All startup errors caught and logged
 * - Loading state shown until ready
 * - Race conditions prevented
 * 
 * Privacy Note: Analytics are privacy-safe (no PII).
 * Location is optional and only used for distance calculations.
 */

import { Component, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ARService } from './services/ar.service';
import { LandmarkService } from './services/landmark.service';
import { AIService, LandmarkExplanation } from './services/ai.service';
import { OfflineService } from './services/offline.service';
import { SubscriptionService } from './services/subscription.service';
import { UsageService } from './services/usage.service';
import { NotificationService } from './services/notification.service';
import { AnalyticsService } from './services/analytics.service';
import { WalkModeService, WalkLandmark } from './services/walk-mode.service';
import { SessionService } from './services/session.service';
import { InterestService } from './services/interest.service';
import { CityPackService } from './services/city-pack.service';
import { AiMemoryService } from './services/ai-memory.service';
import { WalkingTourService } from './services/walking-tour.service';
import { CityService } from './services/city.service';
import { RatingService } from './services/rating.service';
import { DemoModeService } from './services/demo-mode.service';
import { GlobalErrorHandlerService } from './services/error-handler.service';
import { PaywallComponent, TourPaywallContext } from './components/paywall.component';
import { NextLandmarkPromptComponent } from './components/next-landmark-prompt.component';
import { OnboardingComponent } from './components/onboarding.component';
import { LandmarkListComponent } from './pages/landmark-list/landmark-list.component';
import { AnalyticsDebugComponent } from './components/analytics-debug.component';
import { TourListComponent } from './pages/tour-list/tour-list.component';
import { TourDetailComponent } from './pages/tour-detail/tour-detail.component';
import { CitySelectionComponent } from './pages/city-selection/city-selection.component';
import { InterestType, AVAILABLE_INTERESTS } from './models/interest.model';
import { CityPackStatus } from './models/city-pack.model';
import { WalkingTour } from './models/walking-tour.model';
import { City } from './models/city.model';
import { PluginListenerHandle } from '@capacitor/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, PaywallComponent, NextLandmarkPromptComponent, OnboardingComponent, LandmarkListComponent, AnalyticsDebugComponent, TourListComponent, TourDetailComponent, CitySelectionComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('ar-city-explorer');
  
  private arService = inject(ARService);
  private landmarkService = inject(LandmarkService);
  private aiService = inject(AIService);
  private offlineService = inject(OfflineService);
  private subscriptionService = inject(SubscriptionService);
  private usageService = inject(UsageService);
  private notificationService = inject(NotificationService);
  private analyticsService = inject(AnalyticsService);
  private walkModeService = inject(WalkModeService);
  private sessionService = inject(SessionService);
  private interestService = inject(InterestService);
  private cityPackService = inject(CityPackService);
  private memoryService = inject(AiMemoryService);
  private walkingTourService = inject(WalkingTourService);
  private cityService = inject(CityService);
  private errorHandler = inject(GlobalErrorHandlerService);
  private ratingService = inject(RatingService);
  private demoModeService = inject(DemoModeService);
  
  private listenerHandle: PluginListenerHandle | null = null;
  private landmarkTappedSub: Subscription | null = null;
  private locationCheckInterval: any = null;
  
  // App initialization state
  isAppReady = signal(false);
  startupError = signal<string | null>(null);
  
  showSheet = signal(false);
  showPaywall = signal(false);
  showOnboarding = signal(false);
  showLandmarkList = signal(false);
  showTourList = signal(false);
  showTourDetail = signal(false);
  showCitySelection = signal(false);
  showPackUpdatePrompt = signal(false);
  showClearMemoryConfirm = signal(false);
  showAnalyticsDebug = signal(false);
  isLoading = signal(false);
  isOffline = signal(false);
  currentExplanation = signal<LandmarkExplanation | null>(null);
  currentLandmarkTags = signal<string[]>([]);
  matchedInterest = signal<string | null>(null);
  visitedBefore = signal<string | null>(null); // "Visited 2 hours ago" etc
  
  // Tour state
  selectedTour = signal<WalkingTour | null>(null);
  tourPaywallContext = signal<TourPaywallContext | null>(null);
  
  // City state
  activeCity = this.cityService.activeCity;
  
  // Expose for template
  isPremium = this.subscriptionService.isPremium;
  downloadedCount = signal(0);
  isDownloading = signal(false);
  
  // Analytics
  isAnalyticsEnabled = this.analyticsService.isEnabled;
  
  // City Pack status
  cityPackStatus = signal<CityPackStatus | null>(null);
  packDownloadProgress = this.cityPackService.downloadProgress;
  isPackDownloading = this.cityPackService.isDownloading;
  
  // Usage tracking
  todayTaps = this.usageService.todayTaps;
  remainingTaps = this.usageService.remainingFreeTaps;
  streak = this.usageService.streak;
  
  // Landmark of the day
  landmarkOfTheDay = signal<{ id: string; name: string } | null>(null);
  
  // Demo mode
  // Bind demo mode checker and add defensive logging so failures surface in the JS console
  isDemoMode = () => {
    try {
      return this.demoModeService.isDemo();
    } catch (err) {
      // Log full error object to help debug the previous `Unhandled Error: {}` case
      // eslint-disable-next-line no-console
      console.error('isDemo() threw an error:', err);
      return false;
    }
  };
  
  // Walk mode
  isWalkModeActive = this.walkModeService.isActive;
  isWalkModePaused = this.walkModeService.isPaused;
  gpsAccuracyPoor = this.walkModeService.gpsAccuracyPoor;
  pendingLandmark = this.walkModeService.pendingLandmark;
  pendingLandmarkDistance = signal<string>('');
  arSessionActive = signal(false);
  
  // Walking context for AI
  private walkingContext = signal<{ distance: number; isWalking: boolean } | null>(null);

  constructor() {
    // React to pending landmark changes
    effect(() => {
      const pending = this.pendingLandmark();
      if (pending && pending.distance) {
        this.pendingLandmarkDistance.set(
          this.walkModeService.formatDistance(pending.distance)
        );
      }
    });

    // When walk mode suggests a pending landmark and AR is active, highlight it in AR
    effect(() => {
      const pending = this.pendingLandmark();
      if (pending && this.arSessionActive()) {
        try {
          this.arService.highlightLandmark(pending.id);
        } catch (err) {
          console.warn('Failed to request AR highlight:', err);
        }
      }
    });
  }

  ngOnInit() {
    this.safeStartup();
  }
  
  /**
   * Safe startup sequence
   * Initializes services in correct order with error handling
   */
  private async safeStartup(): Promise<void> {
    try {
      // Phase 1: Core services (must succeed)
      this.analyticsService.startSession();
      
      // Phase 2: Data integrity check
      const integrityReport = this.offlineService.runIntegrityCheck();
      if (!integrityReport.isValid) {
        console.warn('Data integrity issues detected, auto-repaired:', integrityReport);
      }
      
      // Phase 3: Load essential data
      await this.loadCitiesSafe();
      
      // Phase 4: Setup listeners (non-critical)
      this.setupLandmarkTapListenerSafe();
      this.updateDownloadedCount();
      this.setupLandmarkOfTheDay();
      this.setupVisibilityListener();
      
      // Phase 5: User experience
      this.checkOnboarding();
      this.checkCityPackUpdates();
      
      // Mark app as ready
      this.isAppReady.set(true);
      
    } catch (error) {
      console.error('Startup error:', error);
      this.startupError.set('App failed to initialize properly. Please restart.');
      
      // Still try to show the app in a degraded state
      this.isAppReady.set(true);
    }
  }
  
  /**
   * Safe city loading with fallback
   */
  private async loadCitiesSafe(): Promise<void> {
    try {
      await this.cityService.loadCities().toPromise();
    } catch (error) {
      console.warn('Failed to load cities, using defaults');
      // City service has built-in fallback
    }
  }
  
  /**
   * Safe listener setup (non-critical)
   */
  private async setupLandmarkTapListenerSafe(): Promise<void> {
    try {
      this.listenerHandle = await this.arService.onLandmarkTap((id) => {
        this.openExplanation(id);
      });
      // Start Observable-based listener for richer payloads
      try {
        this.arService.startListeningForTaps();
        this.landmarkTappedSub = this.arService.landmarkTapped$.subscribe((data: any) => {
          // Use the id from payload to open explanation and do not close AR
          const id = data?.id;
          if (id) {
            this.openExplanation(id, false, data?.name, data?.distance, data?.bearing);
          }
        });
      } catch (err) {
        console.warn('Failed to subscribe to landmarkTapped observable:', err);
      }
    } catch (error) {
      console.warn('Failed to setup AR listener:', error);
      // AR features will be unavailable but app continues
    }
  }

  // Load cities from JSON - now called from safeStartup
  private loadCities() {
    this.cityService.loadCities().subscribe();
  }
  
  private checkOnboarding() {
    // Show onboarding if user hasn't selected interests yet
    if (!this.interestService.hasCompletedOnboarding()) {
      this.showOnboarding.set(true);
    }
  }
  
  // Check for city pack updates on startup
  private checkCityPackUpdates() {
    const city = this.cityService.activeCity();
    const cityId = city?.id || 'dallas';
    
    this.cityPackService.getPackStatus(cityId).subscribe(status => {
      this.cityPackStatus.set(status);
      
      // If premium user has outdated pack, prompt for update
      if (this.isPremium() && status.isDownloaded && status.isOutdated) {
        this.showPackUpdatePrompt.set(true);
      }
    });
  }
  
  onOnboardingComplete() {
    this.showOnboarding.set(false);
    this.analyticsService.track('onboarding_complete', { 
      interests: this.interestService.getInterests().join(',') 
    });
  }

  ngOnDestroy() {
    this.listenerHandle?.remove();
    this.landmarkTappedSub?.unsubscribe();
    this.analyticsService.endSession();
    this.stopWalkMode();
    if (this.locationCheckInterval) {
      clearInterval(this.locationCheckInterval);
    }
  }

  // Replaced by setupLandmarkTapListenerSafe() for error handling
  
  private updateDownloadedCount() {
    this.downloadedCount.set(this.offlineService.getDownloadedCount());
  }
  
  // Handle app going to background/foreground
  private setupVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // App went to background
          if (this.isWalkModeActive()) {
            this.walkModeService.pauseWalk();
          }
        } else {
          // App came back to foreground
          if (this.isWalkModeActive()) {
            this.walkModeService.resumeWalk();
          }
        }
      });
    }
  }
  
  private setupLandmarkOfTheDay() {
    // Use the new LandmarkService LOTD logic (persisted per city per day)
    const cityId = this.cityService.activeCityId();
    const lotd = this.landmarkService.getLandmarkOfTheDay(cityId);
    
    if (lotd) {
      this.landmarkOfTheDay.set({ id: lotd.id, name: lotd.name });
      
      // Also schedule notification if not already done
      const existingNotif = this.notificationService.getLandmarkOfTheDay();
      if (!existingNotif || existingNotif.id !== lotd.id) {
        this.notificationService.scheduleLandmarkOfTheDay({
          id: lotd.id,
          name: lotd.name
        });
      }
    }
  }

  /**
   * Explore Landmark of the Day
   * Free for all users - doesn't count toward daily limit
   */
  exploreLandmarkOfTheDay() {
    const lotd = this.landmarkOfTheDay();
    if (!lotd) return;
    
    // Track analytics
    this.analyticsService.track('landmark_of_day_viewed', {
      landmarkId: lotd.id,
      landmarkName: lotd.name
    });
    
    // Open explanation without counting toward limit
    this.openExplanation(lotd.id, true); // true = isLotd
  }

  // Landmark List Navigation
  openLandmarkList() {
    this.analyticsService.track('landmark_list_open');
    this.showLandmarkList.set(true);
  }

  closeLandmarkList() {
    this.showLandmarkList.set(false);
  }

  // City Navigation
  openCitySelection() {
    this.analyticsService.track('city_list_view');
    this.showCitySelection.set(true);
  }

  closeCitySelection() {
    this.showCitySelection.set(false);
  }

  onCitySelected(city: City) {
    this.analyticsService.track('city_selected', { city_id: city.id });
    this.showCitySelection.set(false);
    
    // Reload landmarks for new city
    this.landmarkService.loadLandmarksForCity(city.id);
    
    // Check for city pack updates
    this.checkCityPackUpdates();
    
    // Update landmark of the day
    this.setupLandmarkOfTheDay();
  }

  // Tour Navigation
  openTourList() {
    this.analyticsService.track('tour_list_open');
    this.showTourList.set(true);
  }

  closeTourList() {
    this.showTourList.set(false);
    this.selectedTour.set(null);
  }

  onTourSelected(tour: WalkingTour) {
    this.selectedTour.set(tour);
    this.showTourList.set(false);
    this.showTourDetail.set(true);
    this.analyticsService.track('tour_viewed', { tour_id: tour.id });
  }

  closeTourDetail() {
    this.showTourDetail.set(false);
    this.showTourList.set(true);
  }

  showTourPaywall() {
    const tour = this.selectedTour();
    if (tour) {
      this.tourPaywallContext.set({
        tourId: tour.id,
        tourTitle: tour.title,
        totalLandmarks: tour.landmarkIds.length,
        previewCount: tour.previewLandmarkCount || 0
      });
      this.analyticsService.track('tour_purchase_prompted', { tour_id: tour.id });
    }
    this.showPaywall.set(true);
  }

  onStartTour() {
    const tour = this.selectedTour();
    if (!tour) return;
    
    this.showTourDetail.set(false);
    
    // Determine if this is preview mode
    const isPreviewMode = tour.isPremium && !this.isPremium();
    this.walkModeService.startTourWalk(tour, isPreviewMode);
    
    this.analyticsService.track('tour_started', { tour_id: tour.id });
    
    // Open AR with tour mode
    const landmarks = this.landmarkService.getLandmarks();
    this.arService.openAR(landmarks);
    this.arSessionActive.set(true);
  }

  // Open AR from list with a specific landmark focused
  openARFromList(focusLandmarkId?: string) {
    this.closeLandmarkList();
    this.analyticsService.track('ar_session_start', { 
      source: 'list',
      focus_landmark: focusLandmarkId || 'none'
    });
    
    const landmarks = this.landmarkService.getLandmarks();
    
    if (focusLandmarkId) {
      this.arService.openARWithFocus(landmarks, focusLandmarkId).then(res => {
        // If AR opened successfully and we have a focused landmark, prefetch the explanation so it's ready when tapped
        if (res?.supported) {
          const focused = landmarks.find(l => l.id === focusLandmarkId);
          if (focused) {
            // Prefetch and cache the explanation
            this.aiService.explainLandmark(focused.id, focused.name).subscribe({
              next: (explanation) => {
                try {
                  this.offlineService.save(focused.id, explanation.name, explanation.text);
                } catch (err) {
                  // non-fatal
                }
              },
              error: () => {}
            });
          }
        }
      });
    } else {
      this.arService.openAR(landmarks);
    }
    
    this.arSessionActive.set(true);
  }

  openAR() {
    console.log('AR button clicked');
    this.analyticsService.track('ar_session_start');
    const landmarks = this.landmarkService.getLandmarks();
    console.log('Landmarks to send:', landmarks.length);
    this.arService.openAR(landmarks);
    this.arSessionActive.set(true);
  }
  
  closeAR() {
    this.arSessionActive.set(false);
    this.arService.clearFocus();
    this.stopWalkMode();
  }
  
  // Walk Mode Controls
  startWalkMode() {
    const started = this.walkModeService.startWalk();
    if (started) {
      this.analyticsService.track('ar_session_start', { mode: 'walk' });
      this.startProximityChecking();
    }
  }
  
  stopWalkMode() {
    this.walkModeService.stopWalk();
    if (this.locationCheckInterval) {
      clearInterval(this.locationCheckInterval);
      this.locationCheckInterval = null;
    }
  }
  
  toggleWalkMode() {
    if (this.isWalkModeActive()) {
      this.stopWalkMode();
    } else {
      this.startWalkMode();
    }
  }
  
  private startProximityChecking() {
    // Check proximity every 2 seconds
    this.locationCheckInterval = setInterval(() => {
      if (!this.isWalkModeActive() || this.isWalkModePaused()) return;
      
      const landmarks = this.landmarkService.getLandmarks();
      const walkLandmarks: WalkLandmark[] = landmarks
        .filter(l => this.sessionService.shouldShow(l.id))
        .map(l => ({
          id: l.id,
          name: l.name,
          latitude: l.lat,
          longitude: l.lng
        }));
      
      this.walkModeService.checkProximity(walkLandmarks);
    }, 2000);
  }
  
  // User tapped "Explore" on the prompt
  onExplorePending() {
    const pending = this.walkModeService.explorePending();
    if (pending) {
      // Set walking context for AI
      this.walkingContext.set({
        distance: pending.distance || 0,
        isWalking: true
      });
      
      this.sessionService.markVisited(pending.id);
      this.openExplanation(pending.id);
    }
  }
  
  // User tapped "Skip" on the prompt
  onSkipPending() {
    const pending = this.pendingLandmark();
    if (pending) {
      this.sessionService.markSkipped(pending.id);
    }
    this.walkModeService.skipPending();
  }

  openExplanation(id: string, isLotd: boolean = false, initialName?: string, initialDistance?: number, initialBearing?: number) {
    const landmarks = this.landmarkService.getLandmarks();
    const landmark = landmarks.find(l => l.id === id);
    const name = initialName || landmark?.name || 'Unknown Landmark';
    const distance = initialDistance ?? null;
    const tags = landmark?.tags || [];
    
    // Store tags for the current landmark
    this.currentLandmarkTags.set(tags);
    
    // Find matched interest for badge display
    const userInterests = this.interestService.getInterests();
    const matched = tags.find(tag => userInterests.includes(tag as InterestType));
    if (matched) {
      const interestInfo = AVAILABLE_INTERESTS.find((i: { type: InterestType }) => i.type === matched);
      this.matchedInterest.set(interestInfo?.label || null);
    } else {
      this.matchedInterest.set(null);
    }
    
    // Check for previous visit memory
    const visitTime = this.memoryService.getTimeSinceVisit(id);
    if (visitTime) {
      this.visitedBefore.set(visitTime);
    } else {
      this.visitedBefore.set(null);
    }
    
    // Track the tap
    const isWalking = this.isWalkModeActive();
    const cityId = this.cityService.activeCityId();
    this.analyticsService.track('landmark_tap', { 
      landmark_id: id, 
      landmark_name: name,
      city_id: cityId,
      mode: isWalking ? 'walk' : 'tap',
      matched_interest: matched || 'none',
      is_lotd: isLotd
    });
    
    // Check if free user hit daily limit (LOTD is always free)
    if (!isLotd && !this.isPremium() && this.usageService.hitDailyLimit()) {
      this.showPaywall.set(true);
      return;
    }
    
    // Record usage for free users (LOTD doesn't count toward limit)
    if (!this.isPremium()) {
      this.usageService.recordTap(id, isLotd);
    }
    
    // If we have an initial name, show the sheet immediately with a placeholder while AI loads
    if (initialName) {
      this.showSheet.set(true);
      this.isLoading.set(true);
      this.isOffline.set(false);
      // Prefill with provided name and optional distance/bearing
      this.currentExplanation.set({ id, name, text: '', distance: initialDistance ?? undefined, bearing: initialBearing ?? undefined } as any);
    }

    // Check offline cache first
    const cached = this.offlineService.get(id);
    if (cached) {
      this.showSheet.set(true);
      this.isLoading.set(false);
      this.isOffline.set(true);
      this.currentExplanation.set({
        id,
        name: cached.name,
        text: cached.text
      });
      this.analyticsService.track('explanation_view', { landmark_id: id, source: 'offline' });
      return;
    }
    
    // Fetch from AI with walking context
    this.showSheet.set(true);
    this.isLoading.set(true);
    this.isOffline.set(false);
    this.currentExplanation.set(null);
    
    // Get walking context if in walk mode
    const context = this.walkingContext();
    
    this.aiService.explainLandmark(id, name, context || undefined).subscribe({
      next: (explanation) => {
        // Merge any existing distance/bearing into the final explanation so UI keeps them
        const merged = { ...explanation } as any;
        if (initialDistance) merged.distance = initialDistance;
        if (initialBearing) merged.bearing = initialBearing;
        this.currentExplanation.set(merged);
        this.isLoading.set(false);
        this.analyticsService.track('explanation_view', { 
          landmark_id: id, 
          source: 'api',
          mode: context?.isWalking ? 'walk' : 'tap',
          is_follow_up: explanation.isFollowUp || false
        });
        
        // Clear walking context after use
        this.walkingContext.set(null);
        
        // Check if we should prompt for rating (after positive engagement)
        this.checkRatingPrompt();
        
        // Save memory for premium users (avoids repetition on revisit)
        if (this.subscriptionService.isPremium()) {
          const userInterests = this.interestService.getInterests();
          const memory = this.memoryService.createMemory(
            id,
            name,
            explanation.text,
            userInterests
          );
          this.memoryService.saveMemory(memory);
        }
        
        // Cache for premium users
        if (this.subscriptionService.isPremium()) {
          this.offlineService.save(id, explanation.name, explanation.text);
          this.updateDownloadedCount();
        }
      },
      error: () => {
        this.currentExplanation.set({
          id,
          name,
          text: 'Unable to load explanation. Please try again.'
        });
        this.isLoading.set(false);
      }
    });
  }

  // Helper to format distances for template
  formatDistance(meters?: number | null): string {
    if (meters === null || typeof meters === 'undefined') return '';
    return this.walkModeService.formatDistance(meters as number);
  }

  /**
   * Check if we should prompt for App Store rating
   * Only prompts after multiple successful sessions, never during AR
   */
  private checkRatingPrompt(): void {
    // Don't prompt during AR session
    if (this.arSessionActive()) return;
    
    // Record successful explanation
    const shouldPrompt = this.analyticsService.recordSuccessfulExplanation();
    
    if (shouldPrompt && this.ratingService.canShowRating()) {
      // Delay slightly so user sees the content first
      setTimeout(() => {
        this.ratingService.requestRating();
      }, 2000);
    }
  }

  closeSheet() {
    this.showSheet.set(false);
    this.currentExplanation.set(null);
  }
  
  closePaywall() {
    this.showPaywall.set(false);
    this.tourPaywallContext.set(null);
  }
  
  onSubscribed(plan: string) {
    this.showPaywall.set(false);
    this.tourPaywallContext.set(null);
    // Show success message or continue with the action
  }
  
  // Share current landmark
  async shareLandmark() {
    const explanation = this.currentExplanation();
    if (!explanation) return;
    
    this.analyticsService.track('share_tap', { landmark_id: explanation.id });
    
    const shareData = {
      title: `${explanation.name} - AR City Explorer`,
      text: `I just discovered ${explanation.name} in Dallas using AR City Explorer! 🏛️`,
      url: `https://arcityexplorer.app/landmark/${explanation.id}`
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        this.analyticsService.track('share_complete', { 
          landmark_id: explanation.id,
          method: 'native' 
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        this.analyticsService.track('share_complete', { 
          landmark_id: explanation.id,
          method: 'clipboard' 
        });
      }
    } catch {
      // User cancelled or error
    }
  }
  
  // Enable notifications
  async enableNotifications() {
    const granted = await this.notificationService.requestPermission();
    if (granted) {
      this.analyticsService.track('notification_enable');
    }
  }
  
  // Download Dallas city pack (Premium only) - uses versioned system
  downloadDallasPack() {
    if (!this.subscriptionService.isPremium()) return;
    
    this.analyticsService.track('offline_download', { city: 'dallas', version: 'latest' });
    
    this.cityPackService.downloadCityPack('dallas').subscribe({
      next: (pack) => {
        if (pack) {
          this.updateDownloadedCount();
          this.checkCityPackUpdates(); // Refresh status
          this.analyticsService.track('offline_download', { 
            city: 'dallas', 
            success: true,
            landmarks: Object.keys(pack.landmarks).length 
          });
        }
      },
      error: () => {
        // Error handling done in service
      }
    });
  }
  
  // Update Dallas pack to latest version
  updateDallasPack() {
    if (!this.subscriptionService.isPremium()) return;
    
    this.showPackUpdatePrompt.set(false);
    this.analyticsService.track('offline_update', { city: 'dallas' });
    
    this.cityPackService.updateCityPack('dallas').subscribe({
      next: (pack) => {
        if (pack) {
          this.updateDownloadedCount();
          this.checkCityPackUpdates();
        }
      }
    });
  }
  
  // Dismiss pack update prompt
  dismissPackUpdate() {
    this.showPackUpdatePrompt.set(false);
  }
  
  // Open paywall manually
  openPaywall() {
    this.analyticsService.track('paywall_view', { source: 'manual' });
    this.showPaywall.set(true);
  }
  
  // Toggle premium for testing
  togglePremium() {
    this.subscriptionService.setPremium(!this.subscriptionService.isPremium());
  }
  
  // === AI Memory Management ===
  
  // Get number of stored memories
  getMemoryCount(): number {
    return this.memoryService.getAllMemories().length;
  }
  
  // Show confirmation for clearing memory
  confirmClearMemory() {
    this.showClearMemoryConfirm.set(true);
  }
  
  // Clear all AI memory
  clearAllMemory() {
    this.memoryService.clearAllMemories();
    this.showClearMemoryConfirm.set(false);
    this.analyticsService.track('memory_cleared');
  }
  
  // Dismiss clear memory confirmation
  dismissClearMemory() {
    this.showClearMemoryConfirm.set(false);
  }
  
  // === Analytics Management ===
  
  // Toggle analytics on/off
  toggleAnalytics() {
    this.analyticsService.toggle();
  }
  
  // === Demo Mode Management ===
  
  /**
   * Secret demo trigger - tap header 5 times quickly
   * For investor presentations
   */
  onHeaderTap() {
    if (this.demoModeService.checkSecretTrigger()) {
      this.analyticsService.track('demo_mode_activated', { source: 'secret_tap' });
      // Force reload to apply demo state
      window.location.reload();
    }
  }
  
  /**
   * Exit demo mode and return to normal state
   */
  exitDemoMode() {
    this.demoModeService.disableDemo();
    this.analyticsService.track('demo_mode_exited');
    // Force reload to clear demo state
    window.location.reload();
  }
}
