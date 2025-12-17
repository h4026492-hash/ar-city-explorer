// User interest types for personalized AI explanations
export type InterestType = 'history' | 'architecture' | 'food' | 'hidden';

export interface Interest {
  type: InterestType;
  label: string;
  icon: string;
  description: string;
}

// Available interests with display info
export const AVAILABLE_INTERESTS: Interest[] = [
  {
    type: 'history',
    label: 'History',
    icon: '📜',
    description: 'Historical events & stories'
  },
  {
    type: 'architecture',
    label: 'Architecture',
    icon: '🏛️',
    description: 'Design, structure & style'
  },
  {
    type: 'food',
    label: 'Food',
    icon: '🍽️',
    description: 'Culinary culture & spots'
  },
  {
    type: 'hidden',
    label: 'Hidden Spots',
    icon: '🔍',
    description: 'Secret gems & local finds'
  }
];

// Helper to get interest by type
export function getInterestByType(type: InterestType): Interest | undefined {
  return AVAILABLE_INTERESTS.find(i => i.type === type);
}

// Helper to get display label for interest match
export function getInterestMatchLabel(type: InterestType): string {
  const labels: Record<InterestType, string> = {
    history: 'Because you like History',
    architecture: 'Matches your interest in Architecture',
    food: 'Recommended for Food lovers',
    hidden: 'A hidden gem, just for you'
  };
  return labels[type];
}
