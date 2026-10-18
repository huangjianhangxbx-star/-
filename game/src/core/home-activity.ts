/** Compatibility seam: one routine controller and the original lifecycle leases, no parallel AI. */
export {HOME_GOALS as HOME_BEHAVIORS} from './home-goals';
export type {HomeRoutine as HomeActivity} from './home-routine';
export {holdHomeRoutine as holdHomeActivity,suspendHomeRoutine as suspendHomeActivity,
  cancelHomeRoutine as cancelHomeActivity,homeRoutineOwnsMovement as homeActivityOwnsMovement,
  advanceHomeRoutine as advanceHomeActivity,homeRoutineDebug as homeActivityDebug} from './home-routine';
