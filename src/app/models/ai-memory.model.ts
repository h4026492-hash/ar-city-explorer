// AI Memory model for persistent landmark context
// PRIVACY: All memory data is stored on-device only. No personal identifiers.

export interface AIMemory {
  landmarkId: string;
  landmarkName: string;
  lastViewedAt: string;      // ISO timestamp
  viewCount: number;         // Times this landmark was explored
  summary: string;           // Short summary of what was explained
  interestContext: string[]; // User interests at time of viewing
  isFollowUp?: boolean;      // Was this a repeat visit?
}

export interface AIMemoryContext {
  hasMemory: boolean;
  previousSummary?: string;
  viewCount?: number;
  lastViewedAt?: string;
  daysSinceLastView?: number;
}
