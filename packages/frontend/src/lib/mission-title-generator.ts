/**
 * Random mission title generator
 * Format: [animal]-[mood]
 * Follows branch naming conventions (no spaces, no illegal characters)
 */

const ANIMALS = [
  'fox', 'wolf', 'bear', 'owl', 'hawk', 'raven', 'tiger', 'lion',
  'panther', 'cobra', 'viper', 'falcon', 'eagle', 'shark', 'whale',
  'orca', 'dolphin', 'otter', 'badger', 'lynx', 'puma', 'jaguar',
  'gecko', 'iguana', 'python', 'mantis', 'hornet', 'wasp', 'beetle',
  'crane', 'heron', 'osprey', 'condor', 'pelican', 'stork', 'ibis',
  'ferret', 'weasel', 'mink', 'stoat', 'mongoose', 'meerkat', 'lemur',
  'gibbon', 'macaw', 'toucan', 'finch', 'sparrow', 'robin', 'jay'
]

const MOODS = [
  'swift', 'calm', 'bold', 'keen', 'wild', 'bright', 'sharp', 'quick',
  'cool', 'warm', 'free', 'brave', 'sly', 'wise', 'proud', 'loud',
  'quiet', 'sleek', 'fierce', 'gentle', 'mighty', 'nimble', 'agile',
  'steady', 'eager', 'ready', 'alert', 'vivid', 'lively', 'mellow',
  'spry', 'deft', 'able', 'apt', 'fit', 'hale', 'prime', 'noble',
  'grand', 'fair', 'true', 'pure', 'neat', 'tidy', 'crisp', 'fresh'
]

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Generates a random mission title in format: animal-mood
 * Example: "fox-swift", "owl-calm", "tiger-bold"
 */
export function generateMissionTitle(): string {
  const animal = getRandomElement(ANIMALS)
  const mood = getRandomElement(MOODS)
  return `${animal}-${mood}`
}

/**
 * Validates a mission title against branch naming conventions
 * - Must be a single word (no spaces)
 * - No illegal characters for git branches: ~ ^ : ? * [ \ space
 * - Must not be empty
 * - Must not start or end with a dot or slash
 * - Must not contain consecutive dots
 */
export function validateMissionTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim() === '') {
    return { valid: false, error: 'Title cannot be empty' }
  }

  if (title.includes(' ')) {
    return { valid: false, error: 'Title cannot contain spaces' }
  }

  // Git branch illegal characters: ~ ^ : ? * [ \ and control characters
  const illegalCharsRegex = /[~^:?*\[\]\\@{}\s]/
  if (illegalCharsRegex.test(title)) {
    return { valid: false, error: 'Title contains illegal characters' }
  }

  if (title.startsWith('.') || title.endsWith('.')) {
    return { valid: false, error: 'Title cannot start or end with a dot' }
  }

  if (title.startsWith('/') || title.endsWith('/')) {
    return { valid: false, error: 'Title cannot start or end with a slash' }
  }

  if (title.includes('..')) {
    return { valid: false, error: 'Title cannot contain consecutive dots' }
  }

  if (title.endsWith('.lock')) {
    return { valid: false, error: 'Title cannot end with .lock' }
  }

  return { valid: true }
}

/**
 * Sanitizes input to be a valid branch-style title
 * - Replaces spaces with hyphens
 * - Removes illegal characters
 * - Converts to lowercase
 */
export function sanitizeMissionTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[~^:?*\[\]\\@{}]/g, '') // Remove illegal chars
    .replace(/\.{2,}/g, '.')        // Replace consecutive dots with single dot
    .replace(/^[./]+|[./]+$/g, '')  // Trim dots and slashes from start/end
}
