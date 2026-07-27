import type { Aircraft, AircraftId } from "../../aircraft/domain/aircraft.ts";

export type SnapshotReconciliation = Readonly<{
  aircraft: readonly Aircraft[];
  selectedAircraftId: AircraftId | null;
  selectionRemoved: boolean;
}>;

export function reconcileSnapshot(
  aircraft: readonly Aircraft[],
  selectedAircraftId: AircraftId | null,
): SnapshotReconciliation {
  const selectionPresent =
    selectedAircraftId === null ||
    aircraft.some((item) => item.id === selectedAircraftId);
  return {
    aircraft: [...aircraft],
    selectedAircraftId: selectionPresent ? selectedAircraftId : null,
    selectionRemoved: selectedAircraftId !== null && !selectionPresent,
  };
}
