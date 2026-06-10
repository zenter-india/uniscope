const ADJECTIVES = [
  'Silent', 'Swift', 'Brave', 'Calm', 'Keen', 'Bold', 'Wise', 'Sharp',
  'Quiet', 'Bright', 'Noble', 'Steady', 'Alert', 'Nimble', 'Clever',
  'Gentle', 'Fierce', 'Humble', 'Eager', 'Lively',
];

const ANIMALS = [
  'Owl', 'Falcon', 'Deer', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Lynx',
  'Otter', 'Crane', 'Heron', 'Tiger', 'Eagle', 'Panda', 'Raven',
  'Dolphin', 'Jaguar', 'Bison', 'Ibis', 'Moose',
];

export function generatePseudonym(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj} ${animal} #${num}`;
}
