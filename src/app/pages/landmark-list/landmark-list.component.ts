import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandmarkService } from '../../services/landmark.service';
import { AIService, LandmarkExplanation } from '../../services/ai.service';
import { ARService } from '../../services/ar.service';
import { OfflineService } from '../../services/offline.service';
import { SubscriptionService } from '../../services/subscription.service';
import { UsageService } from '../../services/usage.service';
import { AnalyticsService } from '../../services/analytics.service';
import { InterestService } from '../../services/interest.service';
import { LandmarkWithDistance } from '../../models/landmark.model';
import { AVAILABLE_INTERESTS } from '../../models/interest.model';

@Component({
  selector: 'app-landmark-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landmark-list.component.html',
  styleUrl: './landmark-list.component.scss'
})
export class LandmarkListComponent implements OnInit {
  private landmarkService = inject(LandmarkService);
  private aiService = inject(AIService);
  private arService = inject(ARService);
  private offlineService = inject(OfflineService);
  private subscriptionService = inject(SubscriptionService);
  private usageService = inject(UsageService);
  private analyticsService = inject(AnalyticsService);
  private interestService = inject(InterestService);

  @Output() back = new EventEmitter<void>();
  @Output() openAR = new EventEmitter<string | undefined>();
  @Output() showPaywall = new EventEmitter<void>();

  landmarks = signal<LandmarkWithDistance[]>([]);
  isLoading = signal(true);
  hasLocation = signal(false);
  
  // Action sheet state
  showActionSheet = signal(false);
  selectedLandmark = signal<LandmarkWithDistance | null>(null);
  
  // Explanation sheet state
  showExplanation = signal(false);
  isLoadingExplanation = signal(false);
  currentExplanation = signal<LandmarkExplanation | null>(null);
  isOfflineContent = signal(false);
  matchedInterest = signal<string | null>(null);

  isPremium = this.subscriptionService.isPremium;

  ngOnInit() {
    this.analyticsService.track('landmark_list_view');
    this.loadLandmarks();
  }

  private loadLandmarks() {
    this.isLoading.set(true);
    
    // Try to get user location
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.hasLocation.set(true);
          const sorted = this.landmarkService.getNearbyLandmarks(
            position.coords.latitude,
            position.coords.longitude
          );
          // Prioritize by user interests
          const prioritized = this.prioritizeByInterests(sorted);
          this.landmarks.set(prioritized);
          this.isLoading.set(false);
        },
        () => {
          // No location - just load all landmarks
          this.loadWithoutLocation();
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      this.loadWithoutLocation();
    }
  }

  private loadWithoutLocation() {
    const all = this.landmarkService.getAllLandmarks();
    const withDistance: LandmarkWithDistance[] = all.map(l => ({
      ...l,
      distance: undefined,
      formattedDistance: undefined
    }));
    const prioritized = this.prioritizeByInterests(withDistance);
    this.landmarks.set(prioritized);
    this.hasLocation.set(false);
    this.isLoading.set(false);
  }

  private prioritizeByInterests(landmarks: LandmarkWithDistance[]): LandmarkWithDistance[] {
    const userInterests = this.interestService.getInterests();
    
    return [...landmarks].sort((a, b) => {
      const aScore = a.tags?.filter(t => userInterests.includes(t as any)).length || 0;
      const bScore = b.tags?.filter(t => userInterests.includes(t as any)).length || 0;
      
      // Higher interest score first, then by distance
      if (bScore !== aScore) return bScore - aScore;
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });
  }

  // Get display label for a tag
  getTagLabel(tag: string): string {
    const interest = AVAILABLE_INTERESTS.find(i => i.type === tag);
    return interest?.label || tag;
  }

  // Get icon for a tag
  getTagIcon(tag: string): string {
    const interest = AVAILABLE_INTERESTS.find(i => i.type === tag);
    return interest?.icon || '📍';
  }

  // Check if tag matches user interest
  isUserInterest(tag: string): boolean {
    return this.interestService.hasInterest(tag as any);
  }

  // Open action sheet for a landmark
  onLandmarkTap(landmark: LandmarkWithDistance) {
    this.selectedLandmark.set(landmark);
    this.showActionSheet.set(true);
    this.analyticsService.track('landmark_tap', { 
      landmark_id: landmark.id,
      landmark_name: landmark.name,
      mode: 'list'
    });
  }

  // Close action sheet
  closeActionSheet() {
    this.showActionSheet.set(false);
    this.selectedLandmark.set(null);
  }

  // View selected landmark in AR
  viewInAR() {
    const landmark = this.selectedLandmark();
    this.closeActionSheet();
    
    if (landmark) {
      this.analyticsService.track('ar_session_start', { 
        source: 'list',
        landmark_id: landmark.id 
      });
      this.openAR.emit(landmark.id);
    }
  }

  // Read explanation for selected landmark
  readExplanation() {
    const landmark = this.selectedLandmark();
    if (!landmark) return;
    
    this.closeActionSheet();
    
    // Check usage limits for free users
    if (!this.isPremium() && this.usageService.hitDailyLimit()) {
      this.showPaywall.emit();
      return;
    }

    // Record usage for free users
    if (!this.isPremium()) {
      this.usageService.recordTap(landmark.id);
    }

    // Check offline cache first
    const cached = this.offlineService.get(landmark.id);
    if (cached) {
      this.showExplanationSheet(landmark, {
        id: landmark.id,
        name: cached.name,
        text: cached.text
      }, true);
      return;
    }

    // Fetch from AI
    this.showExplanation.set(true);
    this.isLoadingExplanation.set(true);
    this.currentExplanation.set(null);
    
    // Find matched interest for badge
    const userInterests = this.interestService.getInterests();
    const matched = landmark.tags?.find(t => userInterests.includes(t as any));
    if (matched) {
      const info = AVAILABLE_INTERESTS.find(i => i.type === matched);
      this.matchedInterest.set(info?.label || null);
    } else {
      this.matchedInterest.set(null);
    }

    this.aiService.explainLandmark(landmark.id, landmark.name).subscribe({
      next: (explanation) => {
        this.showExplanationSheet(landmark, explanation, false);
        
        // Cache for premium users
        if (this.isPremium()) {
          this.offlineService.save(landmark.id, explanation.name, explanation.text);
        }
      },
      error: () => {
        this.currentExplanation.set({
          id: landmark.id,
          name: landmark.name,
          text: 'Unable to load explanation. Please try again.'
        });
        this.isLoadingExplanation.set(false);
      }
    });
  }

  private showExplanationSheet(
    landmark: LandmarkWithDistance, 
    explanation: LandmarkExplanation,
    isOffline: boolean
  ) {
    this.currentExplanation.set(explanation);
    this.isLoadingExplanation.set(false);
    this.isOfflineContent.set(isOffline);
    this.showExplanation.set(true);
    
    // Find matched interest for badge
    const userInterests = this.interestService.getInterests();
    const matched = landmark.tags?.find(t => userInterests.includes(t as any));
    if (matched) {
      const info = AVAILABLE_INTERESTS.find(i => i.type === matched);
      this.matchedInterest.set(info?.label || null);
    } else {
      this.matchedInterest.set(null);
    }

    this.analyticsService.track('explanation_view', { 
      landmark_id: landmark.id,
      source: isOffline ? 'offline' : 'api',
      mode: 'list'
    });
  }

  closeExplanation() {
    this.showExplanation.set(false);
    this.currentExplanation.set(null);
    this.matchedInterest.set(null);
  }

  // Share landmark
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
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        this.analyticsService.track('share_complete', { 
          landmark_id: explanation.id,
          method: 'native' 
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
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

  goBack() {
    this.back.emit();
  }
}
