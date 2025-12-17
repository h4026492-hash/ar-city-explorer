import { Component, inject, signal, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WalkingTourService } from '../../services/walking-tour.service';
import { SubscriptionService } from '../../services/subscription.service';
import { LandmarkService } from '../../services/landmark.service';
import { AnalyticsService } from '../../services/analytics.service';
import { WalkingTour } from '../../models/walking-tour.model';
import { Landmark } from '../../models/landmark.model';

@Component({
  selector: 'app-tour-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tour-detail-container">
      <!-- Header with back button -->
      <div class="detail-header">
        <button class="back-button" (click)="back.emit()">
          <span class="back-icon">←</span>
        </button>
        @if (tour?.isPremium) {
          <div class="premium-indicator">
            <span>⭐</span> Premium Tour
          </div>
        }
      </div>
      
      <!-- Tour Info -->
      <div class="tour-info">
        <h1 class="tour-title">{{ tour?.title }}</h1>
        <p class="tour-description">{{ tour?.description }}</p>
        
        <div class="tour-stats">
          <div class="stat">
            <span class="stat-value">{{ tour?.durationMinutes }}</span>
            <span class="stat-label">minutes</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-value">{{ formatDistance(tour?.distanceMeters || 0) }}</span>
            <span class="stat-label">distance</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-value">{{ tour?.landmarkIds?.length }}</span>
            <span class="stat-label">stops</span>
          </div>
        </div>
      </div>
      
      <!-- Landmark List -->
      <div class="landmarks-section">
        <h2 class="section-title">Tour Stops</h2>
        
        <div class="landmark-list">
          @for (landmark of tourLandmarks(); track landmark.id; let i = $index) {
            <div 
              class="landmark-item"
              [class.locked]="isLocked(i)"
              [class.preview]="isPreview(i)">
              
              <!-- Step indicator -->
              <div class="step-indicator">
                @if (isLocked(i)) {
                  <span class="lock-icon">🔒</span>
                } @else {
                  <span class="step-number">{{ i + 1 }}</span>
                }
              </div>
              
              <!-- Connection line -->
              @if (i < tourLandmarks().length - 1) {
                <div class="connection-line" [class.locked]="isLocked(i + 1)"></div>
              }
              
              <!-- Landmark info -->
              <div class="landmark-info">
                <h3 class="landmark-name">
                  @if (isLocked(i)) {
                    {{ landmark.name }}
                  } @else {
                    {{ landmark.name }}
                  }
                </h3>
                
                @if (!isLocked(i) && landmark.tags?.length) {
                  <div class="landmark-tags">
                    @for (tag of landmark.tags?.slice(0, 2); track tag) {
                      <span class="tag">{{ tag }}</span>
                    }
                  </div>
                }
                
                @if (isLocked(i)) {
                  <p class="locked-message">Unlock with Premium</p>
                }
              </div>
            </div>
          }
        </div>
      </div>
      
      <!-- Preview limit notice -->
      @if (showPreviewNotice()) {
        <div class="preview-notice">
          <div class="notice-icon">🔓</div>
          <div class="notice-content">
            <h3>Preview Mode</h3>
            <p>You can explore {{ tour?.previewLandmarkCount }} of {{ tour?.landmarkIds?.length }} stops for free. Upgrade to Premium for the full tour.</p>
          </div>
        </div>
      }
      
      <!-- Action Button -->
      <div class="action-section">
        @if (canStartFull()) {
          <button class="start-button full" (click)="startTour()">
            <span class="button-icon">🚶</span>
            Start Full Tour
          </button>
        } @else if (tour?.isPremium) {
          <button class="start-button preview" (click)="startTour()">
            <span class="button-icon">👀</span>
            Start Preview ({{ tour?.previewLandmarkCount }} stops)
          </button>
          <button class="upgrade-button" (click)="showPaywall.emit()">
            <span class="button-icon">⭐</span>
            Unlock Full Tour
          </button>
        } @else {
          <button class="start-button full" (click)="startTour()">
            <span class="button-icon">🚶</span>
            Start Tour
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .tour-detail-container {
      min-height: 100vh;
      background: #0B0F14;
      padding: 20px;
      padding-top: env(safe-area-inset-top, 20px);
      padding-bottom: 140px;
    }
    
    .detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    
    .back-button {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      
      .back-icon {
        font-size: 22px;
        color: #fff;
      }
      
      &:active {
        transform: scale(0.95);
      }
    }
    
    .premium-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      color: #F59E0B;
    }
    
    .tour-info {
      margin-bottom: 32px;
    }
    
    .tour-title {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 12px 0;
      line-height: 1.2;
    }
    
    .tour-description {
      font-size: 16px;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.7);
      margin: 0 0 24px 0;
    }
    
    .tour-stats {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 20px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 16px;
    }
    
    .stat {
      text-align: center;
      
      .stat-value {
        display: block;
        font-size: 24px;
        font-weight: 700;
        color: #fff;
      }
      
      .stat-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }
    
    .stat-divider {
      width: 1px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .landmarks-section {
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin: 0 0 16px 0;
    }
    
    .landmark-list {
      display: flex;
      flex-direction: column;
    }
    
    .landmark-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      position: relative;
      padding-bottom: 24px;
      
      &.locked {
        .landmark-name {
          color: rgba(255, 255, 255, 0.4);
        }
      }
      
      &.preview {
        .step-indicator {
          background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
        }
      }
    }
    
    .step-indicator {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      z-index: 1;
      
      .step-number {
        font-size: 14px;
        font-weight: 700;
        color: #60A5FA;
      }
      
      .lock-icon {
        font-size: 14px;
      }
    }
    
    .connection-line {
      position: absolute;
      left: 17px;
      top: 36px;
      width: 2px;
      height: calc(100% - 36px);
      background: rgba(59, 130, 246, 0.3);
      
      &.locked {
        background: rgba(255, 255, 255, 0.1);
      }
    }
    
    .landmark-info {
      flex: 1;
      padding-top: 6px;
    }
    
    .landmark-name {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin: 0 0 6px 0;
    }
    
    .landmark-tags {
      display: flex;
      gap: 8px;
      
      .tag {
        font-size: 11px;
        padding: 4px 10px;
        background: rgba(139, 92, 246, 0.15);
        color: #A78BFA;
        border-radius: 10px;
      }
    }
    
    .locked-message {
      font-size: 12px;
      color: #F59E0B;
      margin: 4px 0 0 0;
    }
    
    .preview-notice {
      display: flex;
      gap: 14px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 16px;
      margin-bottom: 24px;
      
      .notice-icon {
        font-size: 24px;
      }
      
      .notice-content {
        h3 {
          font-size: 15px;
          font-weight: 600;
          color: #F59E0B;
          margin: 0 0 4px 0;
        }
        
        p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          line-height: 1.4;
        }
      }
    }
    
    .action-section {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 20px;
      padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      background: linear-gradient(to top, #0B0F14 0%, #0B0F14 80%, transparent 100%);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .start-button {
      width: 100%;
      padding: 18px;
      border: none;
      border-radius: 16px;
      font-size: 17px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.15s ease;
      
      &.full {
        background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
        color: #fff;
      }
      
      &.preview {
        background: rgba(59, 130, 246, 0.15);
        color: #60A5FA;
        border: 1px solid rgba(59, 130, 246, 0.3);
      }
      
      &:active {
        transform: scale(0.98);
      }
      
      .button-icon {
        font-size: 18px;
      }
    }
    
    .upgrade-button {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%);
      color: #F59E0B;
      border: 1px solid rgba(245, 158, 11, 0.3);
      transition: all 0.15s ease;
      
      &:active {
        transform: scale(0.98);
      }
      
      .button-icon {
        font-size: 16px;
      }
    }
  `]
})
export class TourDetailComponent implements OnInit, OnChanges {
  private tourService = inject(WalkingTourService);
  private subscriptionService = inject(SubscriptionService);
  private landmarkService = inject(LandmarkService);
  private analyticsService = inject(AnalyticsService);

  @Input() tour: WalkingTour | null = null;
  
  @Output() back = new EventEmitter<void>();
  @Output() startTourEvent = new EventEmitter<WalkingTour>();
  @Output() showPaywall = new EventEmitter<void>();

  tourLandmarks = signal<Landmark[]>([]);
  isPremium = this.subscriptionService.isPremium;

  ngOnInit() {
    this.loadLandmarks();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tour']) {
      this.loadLandmarks();
    }
  }

  private loadLandmarks() {
    const t = this.tour;
    if (!t) return;

    const allLandmarks = this.landmarkService.getLandmarks();
    const ordered = t.landmarkIds
      .map(id => allLandmarks.find(l => l.id === id))
      .filter((l): l is Landmark => l !== undefined);
    
    this.tourLandmarks.set(ordered);
  }

  canStartFull(): boolean {
    const t = this.tour;
    if (!t) return false;
    return !t.isPremium || this.isPremium();
  }

  showPreviewNotice(): boolean {
    const t = this.tour;
    if (!t) return false;
    return t.isPremium && !this.isPremium();
  }

  isLocked(index: number): boolean {
    const t = this.tour;
    if (!t || !t.isPremium) return false;
    if (this.isPremium()) return false;
    return index >= t.previewLandmarkCount;
  }

  isPreview(index: number): boolean {
    const t = this.tour;
    if (!t || !t.isPremium) return false;
    if (this.isPremium()) return false;
    return index < t.previewLandmarkCount;
  }

  startTour() {
    const t = this.tour;
    if (!t) return;

    this.analyticsService.track('tour_started' as any, {
      tour_id: t.id,
      is_premium: t.isPremium,
      is_preview: t.isPremium && !this.isPremium()
    });

    this.startTourEvent.emit(t);
  }

  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(1) + ' km';
    }
    return meters + ' m';
  }
}
