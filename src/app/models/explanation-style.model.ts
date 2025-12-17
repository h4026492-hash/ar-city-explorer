/**
 * Explanation Style Model
 * 
 * Controls the tone and format of AI-generated explanations.
 * Ensures premium, human-like quality across all content.
 */

export type ExplanationTone = 'conversational' | 'storytelling' | 'insightful';
export type ExplanationLength = 'short' | 'medium';
export type ExplanationPerspective = 'here-and-now';

export interface ExplanationStyle {
  /** The overall tone of the explanation */
  tone: ExplanationTone;
  
  /** Target length: short (40-60 words) or medium (80-120 words) */
  length: ExplanationLength;
  
  /** Always written as if the user is standing at the location */
  perspective: ExplanationPerspective;
  
  /** Avoid clichés like "popular tourist destination" */
  avoidGenericTouristLanguage: boolean;
}

/** Default style for all explanations */
export const DEFAULT_EXPLANATION_STYLE: ExplanationStyle = {
  tone: 'conversational',
  length: 'medium',
  perspective: 'here-and-now',
  avoidGenericTouristLanguage: true
};

/** Shorter style for walk mode and follow-ups */
export const SHORT_EXPLANATION_STYLE: ExplanationStyle = {
  tone: 'insightful',
  length: 'short',
  perspective: 'here-and-now',
  avoidGenericTouristLanguage: true
};

/** Storytelling style for first visits to major landmarks */
export const STORYTELLING_STYLE: ExplanationStyle = {
  tone: 'storytelling',
  length: 'medium',
  perspective: 'here-and-now',
  avoidGenericTouristLanguage: true
};
