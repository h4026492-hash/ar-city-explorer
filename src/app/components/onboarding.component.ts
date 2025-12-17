import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InterestService } from '../services/interest.service';
import { InterestType, AVAILABLE_INTERESTS, Interest } from '../models/interest.model';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-container">
      <div class="onboarding-content">
        <!-- Header -->
        <div class="onboarding-header">
          <h1>What do you want to explore?</h1>
          <p>Select your interests for personalized discoveries</p>
        </div>
        
        <!-- Interest Cards -->
        <div class="interest-grid">
          @for (interest of interests; track interest.type) {
            <button 
              class="interest-card"
              [class.selected]="isSelected(interest.type)"
              (click)="toggle(interest.type)">
              <span class="interest-icon">{{ interest.icon }}</span>
              <span class="interest-label">{{ interest.label }}</span>
              <span class="interest-desc">{{ interest.description }}</span>
              @if (isSelected(interest.type)) {
                <span class="check-mark">✓</span>
              }
            </button>
          }
        </div>
        
        <!-- Selection hint -->
        <p class="selection-hint">
          {{ selectedCount() }} selected · You can change this anytime
        </p>
        
        <!-- Continue Button -->
        <button 
          class="continue-button"
          [disabled]="selectedCount() === 0"
          (click)="onContinue()">
          Continue
        </button>
      </div>
    </div>
  `,
  styles: [`
    .onboarding-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(180deg, #0B0F14 0%, #111827 100%);
    }
    
    .onboarding-content {
      width: 100%;
      max-width: 400px;
    }
    
    .onboarding-header {
      text-align: center;
      margin-bottom: 32px;
      
      h1 {
        font-size: 26px;
        font-weight: 700;
        color: white;
        margin: 0 0 8px;
      }
      
      p {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }
    }
    
    .interest-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .interest-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      
      &:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
      }
      
      &.selected {
        background: rgba(59, 130, 246, 0.15);
        border-color: #3B82F6;
        
        .interest-label {
          color: #3B82F6;
        }
      }
    }
    
    .interest-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    
    .interest-label {
      font-size: 15px;
      font-weight: 600;
      color: white;
      margin-bottom: 4px;
    }
    
    .interest-desc {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }
    
    .check-mark {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 22px;
      height: 22px;
      background: #3B82F6;
      border-radius: 50%;
      color: white;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .selection-hint {
      text-align: center;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.4);
      margin-bottom: 24px;
    }
    
    .continue-button {
      width: 100%;
      padding: 18px;
      font-size: 17px;
      font-weight: 600;
      color: white;
      background: linear-gradient(135deg, #3B82F6, #8B5CF6);
      border: none;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.15s ease;
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
      }
      
      &:active {
        transform: scale(0.98);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
    }
  `]
})
export class OnboardingComponent {
  private interestService = inject(InterestService);
  
  completed = output<void>();
  
  interests = AVAILABLE_INTERESTS;
  selected = signal<Set<InterestType>>(new Set(['history']));
  
  selectedCount = () => this.selected().size;
  
  isSelected(type: InterestType): boolean {
    return this.selected().has(type);
  }
  
  toggle(type: InterestType): void {
    this.selected.update(set => {
      const newSet = new Set(set);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  }
  
  onContinue(): void {
    const selectedArray = [...this.selected()];
    this.interestService.setInterests(selectedArray);
    this.completed.emit();
  }
}
