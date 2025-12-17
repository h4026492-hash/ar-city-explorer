/**
 * AI Prompt Service
 * 
 * Centralizes all AI prompt construction for consistent,
 * premium-quality explanations.
 * 
 * Quality Rules:
 * - Speak as if guiding someone standing at the location
 * - Use natural spoken language
 * - Avoid generic tourist phrases
 * - No emojis, no lists, no marketing language
 * - Keep prompts under 120 words
 */

import { Injectable } from '@angular/core';
import { 
  ExplanationStyle, 
  DEFAULT_EXPLANATION_STYLE, 
  SHORT_EXPLANATION_STYLE 
} from '../models/explanation-style.model';
import { InterestType } from '../models/interest.model';
import { AIMemoryContext } from '../models/ai-memory.model';

export interface PromptContext {
  landmarkId: string;
  landmarkName: string;
  cityId: string;
  distance?: number;
  interests: InterestType[];
  memory?: AIMemoryContext;
  isWalkMode: boolean;
  style?: ExplanationStyle;
}

@Injectable({ providedIn: 'root' })
export class AiPromptService {
  
  // ─────────────────────────────────────────────────────
  // BASE SYSTEM PROMPT
  // ─────────────────────────────────────────────────────
  
  private readonly BASE_SYSTEM_PROMPT = `
You are a knowledgeable local guide speaking to someone standing at this exact location.

RULES:
- Speak naturally, as if talking to a friend
- Reference the immediate surroundings ("from where you're standing", "look up")
- Use present tense
- Avoid phrases like "popular tourist destination", "this landmark is known for", "must-see"
- Avoid dates unless they add emotional weight
- No emojis
- No bullet points or lists
- No marketing language
- Keep response between 40-100 words
`.trim();

  // ─────────────────────────────────────────────────────
  // INTEREST LAYERS
  // ─────────────────────────────────────────────────────
  
  private readonly INTEREST_PROMPTS: Record<InterestType, string> = {
    history: `Focus on the human stories and pivotal moments that happened here. What would it have felt like to be here during key events?`,
    architecture: `Describe the materials, shapes, and design choices. What was the architect trying to achieve? What details are easy to miss?`,
    food: `Connect this place to the local food culture. What flavors or dining experiences are nearby? What do locals eat here?`,
    hidden: `Reveal something most visitors overlook. A lesser-known detail, an insider perspective, or a quiet moment to appreciate.`
  };

  // ─────────────────────────────────────────────────────
  // WALK MODE CONTEXT
  // ─────────────────────────────────────────────────────
  
  private readonly WALK_MODE_PROMPT = `
The user is walking toward this location. 
- Mention the journey naturally ("as you approach", "notice ahead")
- Keep it brief, they're moving
- No repetitive orientation instructions
`.trim();

  // ─────────────────────────────────────────────────────
  // MEMORY CONTEXT (FOLLOW-UP VISITS)
  // ─────────────────────────────────────────────────────
  
  private readonly MEMORY_PROMPT = `
The user has visited before. 
- Do NOT repeat basic facts
- Share a new angle, detail, or perspective
- Keep response under 60 words
- Acknowledge familiarity subtly without saying "previously" or "last time"
`.trim();

  // ─────────────────────────────────────────────────────
  // NATURAL OPENERS
  // ─────────────────────────────────────────────────────
  
  private readonly OPENERS = [
    'Right here, you\'re looking at',
    'From where you\'re standing,',
    'This is',
    'You\'re at',
    'Standing here,',
    'What you\'re seeing is',
    'Right in front of you,'
  ];

  // ─────────────────────────────────────────────────────
  // NATURAL CLOSERS
  // ─────────────────────────────────────────────────────
  
  private readonly CLOSERS = [
    'Take a moment to look up.',
    'Notice the details as you walk past.',
    'Worth pausing here for a moment.',
    'Look around – there\'s more to see.',
    'Take it in before moving on.',
    ''  // Sometimes no closer is better
  ];

  // ─────────────────────────────────────────────────────
  // BUILD PROMPT
  // ─────────────────────────────────────────────────────
  
  /**
   * Build a complete prompt for AI explanation generation
   */
  buildPrompt(context: PromptContext): string {
    const parts: string[] = [];
    const style = context.style || DEFAULT_EXPLANATION_STYLE;
    
    // 1. Base system prompt
    parts.push(this.BASE_SYSTEM_PROMPT);
    
    // 2. Style-specific instructions
    parts.push(this.getStyleInstructions(style));
    
    // 3. Interest layers (only matching interests)
    if (context.interests.length > 0) {
      const interestPrompts = context.interests
        .slice(0, 2) // Max 2 interests
        .map(i => this.INTEREST_PROMPTS[i])
        .filter(Boolean);
      
      if (interestPrompts.length > 0) {
        parts.push('USER INTERESTS:');
        parts.push(interestPrompts.join(' '));
      }
    }
    
    // 4. Walk mode context
    if (context.isWalkMode) {
      parts.push(this.WALK_MODE_PROMPT);
      if (context.distance) {
        parts.push(`Distance to landmark: ${Math.round(context.distance)}m`);
      }
    }
    
    // 5. Memory context (repeat visits)
    if (context.memory?.hasMemory) {
      parts.push(this.MEMORY_PROMPT);
      if (context.memory.viewCount && context.memory.viewCount > 2) {
        parts.push(`This is visit #${context.memory.viewCount}.`);
      }
    }
    
    // 6. Location context
    parts.push(`LOCATION: ${context.landmarkName}, ${this.getCityName(context.cityId)}`);
    
    // 7. Final instruction
    parts.push('Generate the explanation now. Start directly with the content, no preamble.');
    
    return parts.join('\n\n');
  }

  /**
   * Get a random natural opener
   */
  getRandomOpener(): string {
    return this.OPENERS[Math.floor(Math.random() * this.OPENERS.length)];
  }

  /**
   * Get a random natural closer
   */
  getRandomCloser(): string {
    return this.CLOSERS[Math.floor(Math.random() * this.CLOSERS.length)];
  }

  // ─────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────

  private getStyleInstructions(style: ExplanationStyle): string {
    const instructions: string[] = [];
    
    // Tone
    switch (style.tone) {
      case 'conversational':
        instructions.push('Tone: Friendly and approachable, like talking to a curious friend.');
        break;
      case 'storytelling':
        instructions.push('Tone: Narrative and evocative, paint a picture with words.');
        break;
      case 'insightful':
        instructions.push('Tone: Sharp and focused, deliver one key insight clearly.');
        break;
    }
    
    // Length
    switch (style.length) {
      case 'short':
        instructions.push('Length: 40-60 words maximum. Be concise.');
        break;
      case 'medium':
        instructions.push('Length: 80-100 words. Enough to engage but not overwhelm.');
        break;
    }
    
    return instructions.join(' ');
  }

  private getCityName(cityId: string): string {
    const cityNames: Record<string, string> = {
      'dallas': 'Dallas, Texas',
      'austin': 'Austin, Texas',
      'houston': 'Houston, Texas',
      'san-antonio': 'San Antonio, Texas'
    };
    return cityNames[cityId] || cityId;
  }

  // ─────────────────────────────────────────────────────
  // QUALITY VALIDATION
  // ─────────────────────────────────────────────────────

  /**
   * Validate response quality
   * Returns { valid: boolean, reason?: string }
   */
  validateResponse(text: string): { valid: boolean; reason?: string } {
    const wordCount = text.split(/\s+/).length;
    
    if (wordCount < 30) {
      return { valid: false, reason: 'too_short' };
    }
    
    if (wordCount > 120) {
      return { valid: false, reason: 'too_long' };
    }
    
    // Check for generic phrases we want to avoid
    const genericPhrases = [
      'popular tourist destination',
      'must-see attraction',
      'iconic landmark',
      'this landmark is known for',
      'visitors from around the world'
    ];
    
    const lowerText = text.toLowerCase();
    for (const phrase of genericPhrases) {
      if (lowerText.includes(phrase)) {
        return { valid: false, reason: 'generic_language' };
      }
    }
    
    return { valid: true };
  }

  /**
   * Build a stricter retry prompt after validation failure
   */
  buildRetryPrompt(context: PromptContext, reason: string): string {
    const basePrompt = this.buildPrompt(context);
    
    let retryInstruction = '';
    switch (reason) {
      case 'too_short':
        retryInstruction = 'RETRY: Previous response was too short. Provide more detail, aim for 60-80 words.';
        break;
      case 'too_long':
        retryInstruction = 'RETRY: Previous response was too long. Be more concise, under 100 words.';
        break;
      case 'generic_language':
        retryInstruction = 'RETRY: Previous response used generic tourist language. Be more specific and authentic.';
        break;
      default:
        retryInstruction = 'RETRY: Improve response quality.';
    }
    
    return `${retryInstruction}\n\n${basePrompt}`;
  }
}
