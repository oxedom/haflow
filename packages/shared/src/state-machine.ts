import { MissionState } from './index';

/**
 * Map of valid state transitions for missions.
 * Each state maps to an array of states it can transition to.
 */
export const VALID_TRANSITIONS: Record<MissionState, MissionState[]> = {
  [MissionState.DRAFT]: [MissionState.GENERATING_PRD],

  [MissionState.GENERATING_PRD]: [
    MissionState.PRD_REVIEW,
    MissionState.COMPLETED_FAILED, // Process failure or cancellation
  ],

  [MissionState.PRD_REVIEW]: [
    MissionState.GENERATING_PRD, // Reject - regenerate PRD
    MissionState.PREPARING_TASKS, // Approve - move to task generation
    MissionState.COMPLETED_FAILED, // Cancellation
  ],

  [MissionState.PREPARING_TASKS]: [
    MissionState.TASKS_REVIEW,
    MissionState.COMPLETED_FAILED, // Process failure or cancellation
  ],

  [MissionState.TASKS_REVIEW]: [
    MissionState.PREPARING_TASKS, // Reject - regenerate tasks
    MissionState.IN_PROGRESS, // Approve - start execution
    MissionState.COMPLETED_FAILED, // Cancellation
  ],

  [MissionState.IN_PROGRESS]: [
    MissionState.COMPLETED_SUCCESS,
    MissionState.COMPLETED_FAILED,
  ],

  // Terminal states cannot transition
  [MissionState.COMPLETED_SUCCESS]: [],
  [MissionState.COMPLETED_FAILED]: [],
};

/**
 * Check if a state transition is valid.
 *
 * @param from - The current state
 * @param to - The target state to transition to
 * @returns true if the transition is valid, false otherwise
 */
export function isValidTransition(from: MissionState, to: MissionState): boolean {
  const validTargets = VALID_TRANSITIONS[from];
  return validTargets.includes(to);
}
