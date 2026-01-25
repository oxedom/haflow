import { ulid } from 'ulid';

// Using ULID for sortable, time-based IDs
export function generateMissionId(): string {
  return `m-${ulid()}`;
}

export function generateRunId(): string {
  return `r-${ulid()}`;
}
