/**
 * Tour Completion Reward Component
 * 
 * Celebration screen shown when user completes a walking tour.
 * Rewards encourage full tour completion and increase retention.
 * 
 * Reward Types:
 * - Hidden landmark unlock
 * - Bonus AI deep dive (cached)
 * - Profile badge
 * 
 * All rewards are cached/pre-generated = zero AI cost.
 */

import { Component, inject, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../services/analytics.service';

export interface TourReward {
  type: 'landmark' | 'deepdive' | 'badge';
  title: string;
  description: string;
  icon: string;
  unlockId?: string;  // For landmarks/badges
}

@Component({
  selector: 'app-tour-completion-reward',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reward-overlay" (click)="dismiss()"></div>
    
    <div class="reward-sheet">
      <!-- Confetti Animation -->
      <div class="confetti-container">
        @for (i of confettiPieces; track i) {
          <div class="confetti" [style.--delay]="i * 0.1 + 's'"></div>
        }
      </div>
      
      <!-- Header -->
      <div class="reward-header">
        <div class="trophy-icon">🏆</div>
        <h2>Tour Complete!</h2>
        <p class="tour-name">{{ tourName() }}</p>
      </div>
      
      <!-- Stats -->
      <div class="tour-stats">
        <div class="stat">
          <span class="stat-value">{{ landmarksVisited() }}</span>
          <span class="stat-label">Landmarks</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ duration() }}m</span>
          <span class="stat-label">Duration</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ distance() }}km</span>
          <span class="stat-label">Walked</span>
        </div>
      </div>
      
      <!-- Reward Card -->
      @if (reward()) {
        <div class="reward-card" [class.unlocked]="rewardClaimed()">
          <div class="reward-icon">{{ reward()!.icon }}</div>
          <div class="reward-info">
            <h3>{{ reward()!.title }}</h3>
            <p>{{ reward()!.description }}</p>
          </div>
          @if (!rewardClaimed()) {
            <button class="claim-button" (click)="claimReward()">
              Claim Reward
            </button>
          } @else {
            <span class="claimed-badge">✓ Claimed</span>
          }
        </div>
      }
      
      <!-- Actions -->
      <div class="reward-actions">
        <button class="share-button" (click)="share()">
          Share Achievement
        </button>
        <button class="done-button" (click)="dismiss()">
          Done
        </button>
      </div>
    </div>
  `,
  styles: [`
    .reward-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(12px);
      z-index: 300;
    }
    
    .reward-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 24px 24px 0 0;
      padding: 32px 24px 40px;
      z-index: 301;
      overflow: hidden;
    }
    
    .confetti-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100px;
      overflow: hidden;
      pointer-events: none;
    }
    
    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--color, #F59E0B);
      top: -10px;
      animation: confetti-fall 3s ease-out var(--delay, 0s) forwards;
      
      &:nth-child(odd) { --color: #3B82F6; }
      &:nth-child(3n) { --color: #10B981; }
      &:nth-child(4n) { --color: #EC4899; }
    }
    
    @keyframes confetti-fall {
      0% {
        transform: translateY(0) rotate(0deg);
        opacity: 1;
        left: calc(50% + var(--delay) * 100px - 50px);
      }
      100% {
        transform: translateY(300px) rotate(720deg);
        opacity: 0;
        left: calc(50% + var(--delay) * 150px - 75px);
      }
    }
    
    .reward-header {
      text-align: center;
      margin-bottom: 24px;
      
      .trophy-icon {
        font-size: 64px;
        margin-bottom: 16px;
        animation: trophy-bounce 0.6s ease-out;
      }
      
      h2 {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        margin: 0 0 8px;
      }
      
      .tour-name {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
      }
    }
    
    @keyframes trophy-bounce {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
    
    .tour-stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 24px;
      
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
          letter-spacing: 1px;
        }
      }
    }
    
    .reward-card {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      
      .reward-icon {
        font-size: 40px;
      }
      
      .reward-info {
        flex: 1;
        
        h3 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 4px;
        }
        
        p {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }
      }
      
      .claim-button {
        background: #F59E0B;
        color: #000;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
      }
      
      .claimed-badge {
        color: #10B981;
        font-weight: 600;
        font-size: 14px;
      }
      
      &.unlocked {
        background: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.3);
      }
    }
    
    .reward-actions {
      display: flex;
      gap: 12px;
      
      button {
        flex: 1;
        padding: 16px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        border: none;
      }
      
      .share-button {
        background: rgba(59, 130, 246, 0.2);
        color: #3B82F6;
      }
      
      .done-button {
        background: #3B82F6;
        color: #fff;
      }
    }
  `]
})
export class TourCompletionRewardComponent {
  private analyticsService = inject(AnalyticsService);
  
  // Inputs
  tourName = input.required<string>();
  landmarksVisited = input<number>(0);
  duration = input<number>(0);
  distance = input<number>(0);
  reward = input<TourReward | null>(null);
  
  // Outputs
  dismissed = output<void>();
  rewardClaimed$ = output<TourReward>();
  
  // State
  rewardClaimed = signal(false);
  confettiPieces = Array.from({ length: 20 }, (_, i) => i);
  
  claimReward(): void {
    const r = this.reward();
    if (!r) return;
    
    this.rewardClaimed.set(true);
    this.rewardClaimed$.emit(r);
    
    this.analyticsService.track('reward_claimed', {
      reward_type: r.type,
      tour_name: this.tourName()
    });
  }
  
  share(): void {
    this.analyticsService.track('tour_share', {
      tour_name: this.tourName(),
      landmarks: this.landmarksVisited()
    });
    
    // Native share if available
    if (navigator.share) {
      navigator.share({
        title: 'I completed a walking tour!',
        text: `Just explored ${this.landmarksVisited()} landmarks on the "${this.tourName()}" tour with AR City Explorer! 🏛️`,
        url: 'https://arcityexplorer.com'
      }).catch(() => {});
    }
  }
  
  dismiss(): void {
    this.dismissed.emit();
  }
}
