import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WalkingTourService } from '../../services/walking-tour.service';
import { SubscriptionService } from '../../services/subscription.service';
import { AnalyticsService } from '../../services/analytics.service';
import { WalkingTour } from '../../models/walking-tour.model';

@Component({
  selector: 'app-tour-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tour-list-container">
      <div class="tour-header">
        <button class="back-button" (click)="back.emit()">
          <span class="back-icon">←</span>
        </button>
        <h1>Walking Tours</h1>
      </div>
      
      <p class="tour-subtitle">
        Curated experiences to discover Dallas
      </p>
      
      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading tours...</p>
        </div>
      } @else {
        <div class="tour-cards">
          @for (tour of tours(); track tour.id) {
            <div 
              class="tour-card" 
              [class.premium]="tour.isPremium"
              (click)="selectTour(tour)">
              
              <!-- Premium Badge -->
              @if (tour.isPremium) {
                <div class="premium-badge">
                  <span class="badge-icon">⭐</span>
                  Premium
                </div>
              }
              
              <!-- Theme Badge -->
              @if (tour.theme) {
                <div class="theme-badge" [attr.data-theme]="tour.theme">
                  {{ getThemeEmoji(tour.theme) }} {{ tour.theme | titlecase }}
                </div>
              }
              
              <h2 class="tour-title">{{ tour.title }}</h2>
              <p class="tour-description">{{ tour.description }}</p>
              
              <div class="tour-meta">
                <div class="meta-item">
                  <span class="meta-icon">🚶</span>
                  <span class="meta-value">{{ formatDistance(tour.distanceMeters) }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-icon">⏱️</span>
                  <span class="meta-value">{{ tour.durationMinutes }} min</span>
                </div>
                <div class="meta-item">
                  <span class="meta-icon">📍</span>
                  <span class="meta-value">{{ tour.landmarkIds.length }} stops</span>
                </div>
              </div>
              
              <!-- Access indicator -->
              <div class="access-indicator">
                @if (!tour.isPremium || isPremium()) {
                  <span class="full-access">Full Access</span>
                } @else {
                  <span class="preview-access">
                    Preview {{ tour.previewLandmarkCount }} of {{ tour.landmarkIds.length }} stops
                  </span>
                }
              </div>
              
              <div class="tour-cta">
                <span class="cta-text">View Tour</span>
                <span class="cta-arrow">→</span>
              </div>
            </div>
          }
          
          @empty {
            <div class="empty-state">
              <span class="empty-icon">🗺️</span>
              <p>No tours available for this city yet.</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tour-list-container {
      min-height: 100vh;
      background: #0B0F14;
      padding: 20px;
      padding-top: env(safe-area-inset-top, 20px);
    }
    
    .tour-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
      
      h1 {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin: 0;
      }
    }
    
    .back-button {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      
      .back-icon {
        font-size: 20px;
        color: #fff;
      }
      
      &:active {
        transform: scale(0.95);
      }
    }
    
    .tour-subtitle {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.6);
      margin: 0 0 24px 0;
    }
    
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      
      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #3B82F6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      p {
        margin-top: 16px;
        color: rgba(255, 255, 255, 0.6);
      }
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .tour-cards {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .tour-card {
      background: linear-gradient(135deg, #1a1f2e 0%, #111827 100%);
      border-radius: 20px;
      padding: 20px;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.05);
      
      &:hover {
        transform: translateY(-2px);
        border-color: rgba(59, 130, 246, 0.3);
      }
      
      &:active {
        transform: scale(0.98);
      }
      
      &.premium {
        border-color: rgba(245, 158, 11, 0.2);
        
        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #F59E0B, #EF4444);
        }
      }
    }
    
    .premium-badge {
      position: absolute;
      top: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: #F59E0B;
      
      .badge-icon {
        font-size: 11px;
      }
    }
    
    .theme-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: rgba(139, 92, 246, 0.15);
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      color: #A78BFA;
      margin-bottom: 12px;
      
      &[data-theme="history"] {
        background: rgba(239, 68, 68, 0.15);
        color: #F87171;
      }
      
      &[data-theme="architecture"] {
        background: rgba(59, 130, 246, 0.15);
        color: #60A5FA;
      }
      
      &[data-theme="art"] {
        background: rgba(236, 72, 153, 0.15);
        color: #F472B6;
      }
      
      &[data-theme="local"] {
        background: rgba(52, 211, 153, 0.15);
        color: #34D399;
      }
    }
    
    .tour-title {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 8px 0;
      padding-right: 100px;
    }
    
    .tour-description {
      font-size: 14px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.6);
      margin: 0 0 16px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .tour-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 14px;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      
      .meta-icon {
        font-size: 14px;
      }
      
      .meta-value {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        font-weight: 500;
      }
    }
    
    .access-indicator {
      margin-bottom: 16px;
      
      .full-access {
        font-size: 12px;
        color: #34D399;
        font-weight: 500;
      }
      
      .preview-access {
        font-size: 12px;
        color: #F59E0B;
        font-weight: 500;
      }
    }
    
    .tour-cta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: rgba(59, 130, 246, 0.15);
      border-radius: 14px;
      
      .cta-text {
        font-size: 15px;
        font-weight: 600;
        color: #60A5FA;
      }
      
      .cta-arrow {
        font-size: 18px;
        color: #60A5FA;
      }
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      
      .empty-icon {
        font-size: 48px;
        display: block;
        margin-bottom: 16px;
      }
      
      p {
        color: rgba(255, 255, 255, 0.5);
      }
    }
  `]
})
export class TourListComponent implements OnInit {
  private tourService = inject(WalkingTourService);
  private subscriptionService = inject(SubscriptionService);
  private analyticsService = inject(AnalyticsService);

  @Output() back = new EventEmitter<void>();
  @Output() selectTourEvent = new EventEmitter<WalkingTour>();

  tours = signal<WalkingTour[]>([]);
  loading = signal(true);
  isPremium = this.subscriptionService.isPremium;

  ngOnInit() {
    this.loadTours();
    this.analyticsService.track('landmark_list_view', { view: 'tours' });
  }

  private loadTours() {
    this.tourService.getAllTours().subscribe(tours => {
      this.tours.set(tours);
      this.loading.set(false);
    });
  }

  selectTour(tour: WalkingTour) {
    this.analyticsService.track('tour_viewed' as any, {
      tour_id: tour.id,
      is_premium: tour.isPremium
    });
    this.selectTourEvent.emit(tour);
  }

  formatDistance(meters: number): string {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(1) + ' km';
    }
    return meters + ' m';
  }

  getThemeEmoji(theme: string): string {
    const emojis: Record<string, string> = {
      history: '🏛️',
      architecture: '🏗️',
      art: '🎨',
      local: '🔮',
      food: '🍽️'
    };
    return emojis[theme] || '📍';
  }
}
