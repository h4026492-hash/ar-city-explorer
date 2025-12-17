import { Component, inject, signal, OnInit, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../services/analytics.service';
import { PaywallExperimentService } from '../services/paywall-experiment.service';
import { DailyAggregate, AnalyticsEvent } from '../models/analytics-event.model';
import { PaywallVariant } from '../models/paywall-variant.model';

/**
 * Debug Analytics View Component
 * 
 * DEV ONLY: This component is for development debugging only.
 * It displays aggregated event counts and recent events.
 * Should NOT be exposed in production builds.
 */
@Component({
  selector: 'app-analytics-debug',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="debug-overlay" (click)="close.emit()">
      <div class="debug-panel" (click)="$event.stopPropagation()">
        <div class="debug-header">
          <h2>📊 Analytics Debug</h2>
          <button class="close-btn" (click)="close.emit()">✕</button>
        </div>
        
        <div class="debug-content">
          <!-- Status -->
          <div class="status-row">
            <span class="label">Analytics Enabled:</span>
            <span [class.enabled]="summary()?.enabled" [class.disabled]="!summary()?.enabled">
              {{ summary()?.enabled ? 'Yes' : 'No' }}
            </span>
            <button class="toggle-btn" (click)="toggleAnalytics()">
              {{ summary()?.enabled ? 'Disable' : 'Enable' }}
            </button>
          </div>
          
          <div class="status-row">
            <span class="label">Raw Events:</span>
            <span class="value">{{ summary()?.rawEventCount || 0 }}</span>
          </div>
          
          <div class="status-row">
            <span class="label">Days Aggregated:</span>
            <span class="value">{{ summary()?.aggregateDays || 0 }}</span>
          </div>
          
          <!-- Total Event Counts -->
          <div class="section">
            <h3>📈 Total Event Counts</h3>
            <div class="event-counts">
              @for (item of totalCountsArray(); track item.event) {
                <div class="count-row">
                  <span class="event-name">{{ item.event }}</span>
                  <span class="count-badge">{{ item.count }}</span>
                </div>
              }
              @empty {
                <p class="empty">No events recorded yet</p>
              }
            </div>
          </div>
          
          <!-- Recent Events -->
          <div class="section">
            <h3>🕐 Recent Events (Last 20)</h3>
            <div class="recent-events">
              @for (event of recentEventsReversed(); track $index) {
                <div class="event-row">
                  <span class="event-name">{{ event.event }}</span>
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                </div>
              }
              @empty {
                <p class="empty">No recent events</p>
              }
            </div>
          </div>
          
          <!-- Daily Aggregates -->
          <div class="section">
            <h3>📅 Daily Aggregates</h3>
            <div class="aggregates">
              @for (agg of summary()?.aggregates; track agg.date) {
                <div class="aggregate-day">
                  <span class="day-label">{{ agg.date }}</span>
                  <div class="day-counts">
                    @for (item of getAggregateItems(agg); track item.event) {
                      <span class="mini-badge">{{ item.event }}: {{ item.count }}</span>
                    }
                  </div>
                </div>
              }
              @empty {
                <p class="empty">No aggregated data yet</p>
              }
            </div>
          </div>
          
          <!-- A/B Test Results -->
          <div class="section">
            <h3>🧪 Paywall A/B Test</h3>
            <div class="experiment-info">
              <div class="current-variant">
                <span class="label">Your Variant:</span>
                <span class="variant-badge">{{ currentVariant() }}</span>
              </div>
              
              <div class="conversion-table">
                <div class="table-header">
                  <span>Variant</span>
                  <span>Views</span>
                  <span>Purchases</span>
                  <span>Conv %</span>
                </div>
                <div class="table-row">
                  <span class="variant-label">A</span>
                  <span>{{ experimentStats().variantAViews }}</span>
                  <span>{{ experimentStats().variantAPurchases }}</span>
                  <span class="conversion">{{ experimentStats().variantAConversion }}%</span>
                </div>
                <div class="table-row">
                  <span class="variant-label">B</span>
                  <span>{{ experimentStats().variantBViews }}</span>
                  <span>{{ experimentStats().variantBPurchases }}</span>
                  <span class="conversion">{{ experimentStats().variantBConversion }}%</span>
                </div>
              </div>
              
              <p class="guidance">
                @if (experimentStats().totalViews < 200) {
                  ⏳ Need {{ 200 - experimentStats().totalViews }} more views for significance
                } @else if (experimentStats().winner) {
                  🏆 Winner: Variant {{ experimentStats().winner }} 
                  ({{ experimentStats().winnerLift }}% lift)
                } @else {
                  📊 Results inconclusive - continue testing
                }
              </p>
              
              <!-- DEV ONLY: Force variant -->
              <div class="dev-actions">
                <button class="dev-btn" (click)="forceVariant('A')">Force A</button>
                <button class="dev-btn" (click)="forceVariant('B')">Force B</button>
                <button class="dev-btn reset" (click)="resetExperiment()">Reset</button>
              </div>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="actions">
            <button class="action-btn refresh" (click)="refresh()">
              🔄 Refresh
            </button>
            <button class="action-btn clear" (click)="clearData()">
              🗑️ Clear All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .debug-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
    }
    
    .debug-panel {
      background: #1a1a2e;
      border-radius: 16px;
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #16213e;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      
      h2 {
        margin: 0;
        font-size: 18px;
        color: #fff;
      }
      
      .close-btn {
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        
        &:hover { color: #fff; }
      }
    }
    
    .debug-content {
      padding: 20px;
      overflow-y: auto;
    }
    
    .status-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      
      .label {
        color: #888;
        font-size: 14px;
      }
      
      .value {
        color: #fff;
        font-weight: 600;
      }
      
      .enabled { color: #4ade80; }
      .disabled { color: #f87171; }
      
      .toggle-btn {
        margin-left: auto;
        padding: 6px 12px;
        font-size: 12px;
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 6px;
        cursor: pointer;
        
        &:hover { background: rgba(59, 130, 246, 0.3); }
      }
    }
    
    .section {
      margin-top: 24px;
      
      h3 {
        font-size: 14px;
        color: #888;
        margin: 0 0 12px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
    }
    
    .event-counts, .recent-events {
      max-height: 200px;
      overflow-y: auto;
    }
    
    .count-row, .event-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      
      .event-name {
        color: #fff;
        font-size: 13px;
        font-family: monospace;
      }
      
      .count-badge {
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }
      
      .event-time {
        color: #666;
        font-size: 12px;
      }
    }
    
    .aggregate-day {
      margin-bottom: 12px;
      
      .day-label {
        display: block;
        color: #888;
        font-size: 12px;
        margin-bottom: 6px;
      }
      
      .day-counts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      
      .mini-badge {
        background: rgba(139, 92, 246, 0.2);
        color: #a78bfa;
        padding: 4px 8px;
        border-radius: 8px;
        font-size: 11px;
      }
    }
    
    .empty {
      color: #666;
      font-size: 13px;
      text-align: center;
      padding: 20px;
    }
    
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      
      .action-btn {
        flex: 1;
        padding: 12px;
        font-size: 14px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
        
        &.refresh {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          
          &:hover { background: rgba(59, 130, 246, 0.3); }
        }
        
        &.clear {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          
          &:hover { background: rgba(239, 68, 68, 0.3); }
        }
      }
    }
    
    .experiment-info {
      background: rgba(139, 92, 246, 0.1);
      border-radius: 12px;
      padding: 16px;
    }
    
    .current-variant {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      
      .label {
        color: #888;
        font-size: 13px;
      }
      
      .variant-badge {
        background: linear-gradient(135deg, #8B5CF6, #3B82F6);
        color: #fff;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 700;
      }
    }
    
    .conversion-table {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 12px;
      
      .table-header, .table-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        padding: 10px 12px;
        text-align: center;
        font-size: 12px;
      }
      
      .table-header {
        background: rgba(0, 0, 0, 0.3);
        color: #888;
        font-weight: 600;
      }
      
      .table-row {
        color: #fff;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        
        .variant-label {
          font-weight: 600;
        }
        
        .conversion {
          color: #34D399;
          font-weight: 600;
        }
      }
    }
    
    .guidance {
      font-size: 12px;
      color: #a78bfa;
      text-align: center;
      margin: 12px 0;
      padding: 8px;
      background: rgba(139, 92, 246, 0.1);
      border-radius: 8px;
    }
    
    .dev-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      
      .dev-btn {
        flex: 1;
        padding: 8px;
        font-size: 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: #fff;
        cursor: pointer;
        
        &:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        
        &.reset {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
        }
      }
    }
  `]
})
export class AnalyticsDebugComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);
  private experimentService = inject(PaywallExperimentService);
  
  @Output() close = new EventEmitter<void>();
  
  summary = signal<{
    enabled: boolean;
    rawEventCount: number;
    aggregateDays: number;
    recentEvents: AnalyticsEvent[];
    aggregates: DailyAggregate[];
  } | null>(null);
  
  totalCountsArray = signal<{ event: string; count: number }[]>([]);
  recentEventsReversed = signal<AnalyticsEvent[]>([]);
  
  // Current variant
  currentVariant = this.experimentService.variant;
  
  // Computed experiment stats
  experimentStats = computed(() => {
    // In a real implementation, you would query your analytics backend
    // For now, we simulate with local event counts from recent events
    const events = this.summary()?.recentEvents || [];
    
    let variantAViews = 0;
    let variantAPurchases = 0;
    let variantBViews = 0;
    let variantBPurchases = 0;
    
    // Count from aggregated data
    const aggregates = this.summary()?.aggregates || [];
    for (const agg of aggregates) {
      // This is a simplified count - real implementation would filter by variant metadata
      variantAViews += (agg.eventCounts['paywall_view'] || 0) / 2;
      variantBViews += (agg.eventCounts['paywall_view'] || 0) / 2;
      variantAPurchases += (agg.eventCounts['purchase_complete'] || 0) / 2;
      variantBPurchases += (agg.eventCounts['purchase_complete'] || 0) / 2;
    }
    
    // Round to integers
    variantAViews = Math.round(variantAViews);
    variantBViews = Math.round(variantBViews);
    variantAPurchases = Math.round(variantAPurchases);
    variantBPurchases = Math.round(variantBPurchases);
    
    const variantAConversion = variantAViews > 0 
      ? ((variantAPurchases / variantAViews) * 100).toFixed(1) 
      : '0.0';
    const variantBConversion = variantBViews > 0 
      ? ((variantBPurchases / variantBViews) * 100).toFixed(1) 
      : '0.0';
    
    const totalViews = variantAViews + variantBViews;
    
    // Determine winner (need at least 100 views per variant)
    let winner: 'A' | 'B' | null = null;
    let winnerLift = '0';
    
    if (variantAViews >= 100 && variantBViews >= 100) {
      const aConv = parseFloat(variantAConversion);
      const bConv = parseFloat(variantBConversion);
      
      if (aConv > bConv * 1.1) { // 10% lift threshold
        winner = 'A';
        winnerLift = (((aConv - bConv) / bConv) * 100).toFixed(0);
      } else if (bConv > aConv * 1.1) {
        winner = 'B';
        winnerLift = (((bConv - aConv) / aConv) * 100).toFixed(0);
      }
    }
    
    return {
      variantAViews,
      variantAPurchases,
      variantAConversion,
      variantBViews,
      variantBPurchases,
      variantBConversion,
      totalViews,
      winner,
      winnerLift
    };
  });

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    const debug = this.analyticsService.getDebugSummary();
    this.summary.set(debug);
    
    // Set recent events reversed
    this.recentEventsReversed.set([...(debug.recentEvents || [])].reverse());
    
    // Convert total counts to sorted array
    const totals = this.analyticsService.getTotalEventCounts();
    const arr = Object.entries(totals)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
    this.totalCountsArray.set(arr);
  }

  toggleAnalytics() {
    this.analyticsService.toggle();
    this.refresh();
  }

  clearData() {
    if (confirm('Clear all analytics data?')) {
      this.analyticsService.clearAllData();
      this.refresh();
    }
  }
  
  forceVariant(variant: PaywallVariant) {
    this.experimentService._devForceVariant(variant);
  }
  
  resetExperiment() {
    this.experimentService._devResetExperiment();
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  getAggregateItems(agg: DailyAggregate): { event: string; count: number }[] {
    return Object.entries(agg.eventCounts)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
  }
}
