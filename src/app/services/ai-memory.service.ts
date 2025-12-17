import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AIMemory, AIMemoryContext } from '../models/ai-memory.model';

/**
 * AI Memory Service
 * 
 * PRIVACY DESIGN:
 * - All memory data is stored exclusively on-device using localStorage
 * - No memory data is ever transmitted to any backend or third-party
 * - No personal identifiers are stored - only landmark IDs and summaries
 * - Memory is tied only to landmark IDs, not user identity
 * - User can clear all memories at any time
 */
@Injectable({ providedIn: 'root' })
export class AiMemoryService {
  private platformId = inject(PLATFORM_ID);
  
  private readonly STORAGE_KEY = 'ai_memories';
  private readonly MAX_MEMORIES = 100; // Limit total stored memories

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // ─────────────────────────────────────────────────────
  // MEMORY ACCESS
  // ─────────────────────────────────────────────────────

  /**
   * Check if memory exists for a landmark
   * PRIVACY: Only checks local storage, no network calls
   */
  hasMemory(landmarkId: string): boolean {
    const memories = this.getAllMemories();
    return memories.some(m => m.landmarkId === landmarkId);
  }

  /**
   * Get memory for a specific landmark
   * PRIVACY: Returns only on-device data
   */
  getMemory(landmarkId: string): AIMemory | null {
    const memories = this.getAllMemories();
    return memories.find(m => m.landmarkId === landmarkId) || null;
  }

  /**
   * Get memory context for AI prompt enrichment
   * PRIVACY: Context is used only to customize local prompts
   */
  getMemoryContext(landmarkId: string): AIMemoryContext {
    const memory = this.getMemory(landmarkId);
    
    if (!memory) {
      return { hasMemory: false };
    }

    const lastViewed = new Date(memory.lastViewedAt);
    const now = new Date();
    const daysSinceLastView = Math.floor(
      (now.getTime() - lastViewed.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      hasMemory: true,
      previousSummary: memory.summary,
      viewCount: memory.viewCount,
      lastViewedAt: memory.lastViewedAt,
      daysSinceLastView
    };
  }

  /**
   * Get all stored memories
   * PRIVACY: All data is local only
   */
  getAllMemories(): AIMemory[] {
    if (!this.isBrowser) return [];
    
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get IDs of all previously visited landmarks
   * PRIVACY: Returns only landmark IDs, no personal data
   */
  getVisitedLandmarkIds(): string[] {
    return this.getAllMemories().map(m => m.landmarkId);
  }

  // ─────────────────────────────────────────────────────
  // MEMORY STORAGE
  // ─────────────────────────────────────────────────────

  /**
   * Save or update memory for a landmark
   * PRIVACY: Stores only to local device storage
   */
  saveMemory(memory: AIMemory): void {
    if (!this.isBrowser) return;

    let memories = this.getAllMemories();
    
    // Check if memory already exists for this landmark
    const existingIndex = memories.findIndex(m => m.landmarkId === memory.landmarkId);
    
    if (existingIndex >= 0) {
      // Update existing memory
      memories[existingIndex] = {
        ...memory,
        viewCount: (memories[existingIndex].viewCount || 1) + 1,
        isFollowUp: true
      };
    } else {
      // Add new memory
      memories.push({
        ...memory,
        viewCount: 1,
        isFollowUp: false
      });
    }

    // Enforce memory limit - remove oldest first
    if (memories.length > this.MAX_MEMORIES) {
      // Sort by lastViewedAt and keep most recent
      memories.sort((a, b) => 
        new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
      );
      memories = memories.slice(0, this.MAX_MEMORIES);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memories));
  }

  /**
   * Create memory from an explanation
   * PRIVACY: Extracts only landmark-related summary, no personal data
   */
  createMemory(
    landmarkId: string,
    landmarkName: string,
    explanationText: string,
    interestContext: string[]
  ): AIMemory {
    // Extract a short summary (first 150 chars or first sentence)
    const summary = this.extractSummary(explanationText);

    return {
      landmarkId,
      landmarkName,
      lastViewedAt: new Date().toISOString(),
      viewCount: 1,
      summary,
      interestContext
    };
  }

  /**
   * Extract a short summary from explanation text
   */
  private extractSummary(text: string): string {
    // Get first sentence or first 150 characters
    const firstSentence = text.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length <= 150) {
      return firstSentence.trim();
    }
    return text.substring(0, 150).trim() + '...';
  }

  // ─────────────────────────────────────────────────────
  // MEMORY MANAGEMENT
  // ─────────────────────────────────────────────────────

  /**
   * Clear all AI memories
   * PRIVACY: Complete local data removal
   */
  clearAllMemories(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Clear memory for a specific landmark
   */
  clearMemory(landmarkId: string): void {
    if (!this.isBrowser) return;
    
    const memories = this.getAllMemories().filter(
      m => m.landmarkId !== landmarkId
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memories));
  }

  /**
   * Get total memory count
   */
  getMemoryCount(): number {
    return this.getAllMemories().length;
  }

  // ─────────────────────────────────────────────────────
  // DISPLAY HELPERS
  // ─────────────────────────────────────────────────────

  /**
   * Get human-readable time since last visit
   */
  getTimeSinceVisit(landmarkId: string): string | null {
    const memory = this.getMemory(landmarkId);
    if (!memory) return null;

    const lastViewed = new Date(memory.lastViewedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastViewed.getTime();
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return 'Visited just now';
    } else if (diffHours < 24) {
      return `Visited ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'Visited yesterday';
    } else if (diffDays < 7) {
      return `Visited ${diffDays} days ago`;
    } else {
      return 'Explored before';
    }
  }
}
