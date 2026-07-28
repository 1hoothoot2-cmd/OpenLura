export type WorldExperienceState =
  | "not-configured"
  | "connecting"
  | "loading-region"
  | "connected"
  | "reconnecting"
  | "invalid-viewport";

export type WorldExperienceStatus = Readonly<{
  label: string;
  tone: "live" | "loading" | "delayed" | "inactive";
}>;

export function presentWorldExperienceStatus(
  state: WorldExperienceState,
  aircraftCount: number,
  replayMode: boolean,
): WorldExperienceStatus {
  if (replayMode) {
    return { label: "Replay • recording live", tone: "inactive" };
  }

  switch (state) {
    case "connected":
      return {
        label:
          aircraftCount > 0
            ? `Live • ${aircraftCount} aircraft`
            : "Live • No aircraft nearby",
        tone: "live",
      };
    case "loading-region":
      return {
        label:
          aircraftCount > 0
            ? `Refreshing • ${aircraftCount} aircraft`
            : "Loading live data",
        tone: "loading",
      };
    case "reconnecting":
      return {
        label:
          aircraftCount > 0
            ? `Live data delayed • ${aircraftCount} aircraft`
            : "Live data delayed",
        tone: "delayed",
      };
    case "invalid-viewport":
      return { label: "Zoom in for live data", tone: "inactive" };
    case "not-configured":
      return { label: "Live unavailable", tone: "delayed" };
    case "connecting":
      return { label: "Connecting", tone: "loading" };
  }
}
