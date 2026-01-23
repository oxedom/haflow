import { v4 as uuidv4 } from 'uuid';

// Using UUID for v0; can switch to ULID later if sortability needed
export function generateMissionId(): string {
  return `m-${uuidv4().slice(0, 8)}`;
}

export function generateRunId(): string {
  return `r-${uuidv4().slice(0, 8)}`;
}
