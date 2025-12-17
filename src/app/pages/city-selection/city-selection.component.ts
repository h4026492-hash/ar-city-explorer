import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CityService } from '../../services/city.service';
import { SubscriptionService } from '../../services/subscription.service';
import { AnalyticsService } from '../../services/analytics.service';
import { City } from '../../models/city.model';

@Component({
  selector: 'app-city-selection',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="city-selection-container">
      <div class="city-header">
        <button class="back-button" (click)="back.emit()" *ngIf="showBackButton">
          <span class="back-icon">←</span>
        </button>
        <h1>Choose Your City</h1>
        <p class="subtitle">Where are you exploring today?</p>
      </div>

      <!-- Available Cities -->
      <div class="section">
        <h2 class="section-title">Available Now</h2>
        <div class="city-grid">
          @for (city of availableCities(); track city.id) {
            <div 
              class="city-card"
              [class.active]="city.id === activeCityId()"
              [class.premium]="city.isPremium"
              (click)="selectCity(city)">
              
              <!-- City Icon -->
              <div class="city-icon">
                {{ getCityEmoji(city.id) }}
              </div>
              
              <!-- City Info -->
              <div class="city-info">
                <h3 class="city-name">{{ city.name }}</h3>
                <p class="city-country">{{ city.country }}</p>
                @if (city.landmarkCount) {
                  <p class="city-landmarks">{{ city.landmarkCount }} landmarks</p>
                }
              </div>
              
              <!-- Status Badge -->
              @if (city.id === activeCityId()) {
                <div class="status-badge active">
                  <span>✓</span> Active
                </div>
              } @else if (city.id === 'austin') {
                <div class="status-badge new">
                  <span>✨</span> New
                </div>
              } @else if (city.isPremium && !isPremium()) {
                <div class="status-badge premium">
                  <span>⭐</span> Premium
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Coming Soon Cities -->
      @if (comingSoonCities().length > 0) {
        <div class="section">
          <h2 class="section-title">Coming Soon</h2>
          <div class="city-grid">
            @for (city of comingSoonCities(); track city.id) {
              <div class="city-card disabled">
                <!-- City Icon -->
                <div class="city-icon muted">
                  {{ getCityEmoji(city.id) }}
                </div>
                
                <!-- City Info -->
                <div class="city-info">
                  <h3 class="city-name">{{ city.name }}</h3>
                  <p class="city-country">{{ city.country }}</p>
                  @if (city.description) {
                    <p class="city-description">{{ city.description }}</p>
                  }
                </div>
                
                <!-- Coming Soon Badge -->
                <div class="status-badge coming-soon">
                  🚧 Coming Soon
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Request a City -->
      <div class="request-section">
        <p>Don't see your city?</p>
        <button class="request-button" (click)="requestCity()">
          Request a City
        </button>
      </div>
    </div>
  `,
  styles: [`
    .city-selection-container {
      min-height: 100vh;
      background: #0B0F14;
      padding: 20px;
      padding-top: env(safe-area-inset-top, 20px);
      padding-bottom: 100px;
    }

    .city-header {
      margin-bottom: 32px;
      
      h1 {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin: 0 0 8px 0;
      }
      
      .subtitle {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }
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
      margin-bottom: 16px;
      
      .back-icon {
        font-size: 22px;
        color: #fff;
      }
      
      &:active {
        transform: scale(0.95);
      }
    }

    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 16px 0;
    }

    .city-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .city-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.15s ease;
      
      &:active {
        transform: scale(0.98);
      }
      
      &.active {
        background: rgba(52, 211, 153, 0.1);
        border-color: rgba(52, 211, 153, 0.4);
      }
      
      &.premium {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%);
        border-color: rgba(245, 158, 11, 0.3);
      }
      
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        
        &:active {
          transform: none;
        }
      }
    }

    .city-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      flex-shrink: 0;
      
      &.muted {
        filter: grayscale(0.5);
        opacity: 0.7;
      }
    }

    .city-info {
      flex: 1;
      min-width: 0;
      
      .city-name {
        font-size: 17px;
        font-weight: 600;
        color: #fff;
        margin: 0 0 2px 0;
      }
      
      .city-country {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0;
      }
      
      .city-landmarks {
        font-size: 12px;
        color: rgba(52, 211, 153, 0.8);
        margin: 4px 0 0 0;
      }
      
      .city-description {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        margin: 4px 0 0 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .status-badge {
      flex-shrink: 0;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      
      &.active {
        background: rgba(52, 211, 153, 0.2);
        color: #34D399;
      }
      
      &.new {
        background: rgba(139, 92, 246, 0.2);
        color: #8B5CF6;
      }
      
      &.premium {
        background: rgba(245, 158, 11, 0.2);
        color: #F59E0B;
      }
      
      &.coming-soon {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .request-section {
      text-align: center;
      padding: 24px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 16px;
      margin-top: 24px;
      
      p {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
        margin: 0 0 12px 0;
      }
    }

    .request-button {
      padding: 12px 24px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      
      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      
      &:active {
        transform: scale(0.98);
      }
    }
  `]
})
export class CitySelectionComponent implements OnInit {
  private cityService = inject(CityService);
  private subscriptionService = inject(SubscriptionService);
  private analyticsService = inject(AnalyticsService);

  @Output() back = new EventEmitter<void>();
  @Output() citySelected = new EventEmitter<City>();
  @Output() showPaywall = new EventEmitter<void>();

  showBackButton = true;
  
  availableCities = this.cityService.availableCities;
  comingSoonCities = this.cityService.comingSoonCities;
  activeCityId = this.cityService.activeCityId;
  isPremium = this.subscriptionService.isPremium;

  ngOnInit() {
    this.cityService.loadCities().subscribe();
    this.analyticsService.track('landmark_list_view', { view: 'cities' });
  }

  selectCity(city: City): void {
    // Check if selection is allowed
    const check = this.cityService.canSelectCity(city.id, this.isPremium());
    
    if (!check.allowed) {
      if (check.reason === 'Premium required') {
        this.analyticsService.track('paywall_view', { 
          trigger: 'premium_city',
          city_id: city.id 
        });
        this.showPaywall.emit();
      }
      return;
    }

    // Set as active city
    const success = this.cityService.setActiveCity(city.id);
    
    if (success) {
      this.analyticsService.track('landmark_tap', { 
        action: 'city_selected',
        city_id: city.id 
      });
      this.citySelected.emit(city);
    }
  }

  getCityEmoji(cityId: string): string {
    const emojis: Record<string, string> = {
      'dallas': '🤠',
      'austin': '🎸',
      'houston': '🚀',
      'san-antonio': '🏰'
    };
    return emojis[cityId] || '🏙️';
  }

  requestCity(): void {
    // Could open a feedback form or mailto link
    this.analyticsService.track('share_tap', { action: 'request_city' });
  }
}
