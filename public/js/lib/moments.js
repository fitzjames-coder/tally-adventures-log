// Pure copy helpers for the stage page. DOM-free so they are unit-testable.

// "Along the way" empty state. A flown leg that simply has no timed moments is
// not the same as a leg that has not been flown yet.
export function alongTheWayEmpty(leg, hasTimedMoments) {
  const flown = !!leg && leg.status === 'flown';
  if (flown && !hasTimedMoments) {
    return { title: 'No moments yet.', text: 'Add flight moments with a time and they line up here.' };
  }
  return { title: 'Not flown yet.', text: 'The timeline fills in after the flight. The planned flight plan is below.' };
}
