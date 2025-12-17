import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-next-landmark-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="prompt-backdrop" (click)="onSkip()"></div>
    
    <div class="prompt-sheet">
      <div class="prompt-handle"></div>
      
      <div class="prompt-content">
        <div class="prompt-icon">📍</div>
        
        <p class="prompt-label">Next landmark ahead</p>
        
        <h3 class="prompt-name">{{ landmarkName() }}</h3>
        
        <p class="prompt-distance">{{ distance() }}</p>
        
        <div class="prompt-actions">
          <button class="action-btn skip" (click)="onSkip()">
            Skip
          </button>
          <button class="action-btn explore" (click)="onExplore()">
            Explore
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .prompt-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      z-index: 150;
      animation: fadeIn 0.2s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .prompt-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, #1a1f2e 0%, #0f1218 100%);
      border-radius: 24px 24px 0 0;
      padding: 16px 24px 32px;
      z-index: 151;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
    }
    
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    
    .prompt-handle {
      width: 36px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      margin: 0 auto 16px;
    }
    
    .prompt-content {
      text-align: center;
    }
    
    .prompt-icon {
      font-size: 32px;
      margin-bottom: 8px;
      animation: bounce 1s ease infinite;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    
    .prompt-label {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .prompt-name {
      font-size: 22px;
      font-weight: 600;
      color: white;
      margin: 0 0 4px;
    }
    
    .prompt-distance {
      font-size: 15px;
      color: #3B82F6;
      margin: 0 0 20px;
    }
    
    .prompt-actions {
      display: flex;
      gap: 12px;
    }
    
    .action-btn {
      flex: 1;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.15s ease;
      
      &:active {
        transform: scale(0.96);
      }
    }
    
    .action-btn.skip {
      color: rgba(255, 255, 255, 0.7);
      background: rgba(255, 255, 255, 0.1);
      
      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
    
    .action-btn.explore {
      color: white;
      background: linear-gradient(135deg, #3B82F6, #8B5CF6);
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
      
      &:hover {
        box-shadow: 0 6px 24px rgba(59, 130, 246, 0.5);
      }
    }
  `]
})
export class NextLandmarkPromptComponent {
  landmarkName = input.required<string>();
  distance = input.required<string>();
  
  explore = output<void>();
  skip = output<void>();
  
  onExplore() {
    this.explore.emit();
  }
  
  onSkip() {
    this.skip.emit();
  }
}
