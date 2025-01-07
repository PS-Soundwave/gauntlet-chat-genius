const adjectives = [
  'happy', 'clever', 'swift', 'bright', 'calm',
  'eager', 'gentle', 'kind', 'lucky', 'proud'
];

const nouns = [
  'panda', 'tiger', 'eagle', 'wolf', 'fox',
  'bear', 'hawk', 'deer', 'lion', 'owl'
];

export function generateUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 100);
  return `${adjective}-${noun}-${number}`;
} 