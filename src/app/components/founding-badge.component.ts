/**
 * Founding Badge Component
 * 
 * A small, elegant badge shown to founding members.
 * 
 * APP STORE COMPLIANCE:
 * This is purely cosmetic recognition for early adopters.
 * It does not affect subscription pricing or features.
 */

import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FoundingUserService } from '../services/founding-user.service';

@Component({
  selector: 'app-founding-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showBadge()) {
      <div class="founding-badge" [class.compact]="compact">
        <span class="badge-icon">✦</span>
        <span class="badge-text">{{ compact ? 'Founder' : 'Founding Member' }}</span>
      </div>
    }
  `,
  styles: [`
    .founding-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15));
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 20px;
      color: #F59E0B;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      
      .badge-icon {
        font-size: 10px;
        animation: subtle-glow 3s ease-in-out infinite;
      }
      
      .badge-text {
        text-transform: uppercase;
      }
      
      &.compact {
        padding: 4px 8px;
        font-size: 10px;
        
        .badge-icon {
          font-size: 8px;
        }
      }
    }
    
    @keyframes subtle-glow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `]
})
export class FoundingBadgeComponent {
  private foundingUserService = inject(FoundingUserService);
  
  /** Use compact styling for smaller spaces */
  @Input() compact = false;
  
  showBadge(): boolean {
    return this.foundingUserService.isFoundingUser();
  }
}
