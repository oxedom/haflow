import { randomBytes } from 'crypto';

// Generate sortable IDs with timestamp prefix + random suffix
// Format: {prefix}-{timestamp_hex_12}{random_hex_4} = 18 chars total
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const random = randomBytes(2).toString('hex');
  return `${prefix}-${timestamp}${random}`;
}

export function generateMissionId(): string {
  return generateId('m');
}

export function generateRunId(): string {
  return generateId('r');
}
