export type ReplayState = Readonly<{
  mode: "live" | "replay";
  playing: boolean;
  positionMillis: number;
  durationMillis: number;
}>;

export const LIVE_REPLAY_STATE: ReplayState = {
  mode: "live",
  playing: false,
  positionMillis: 0,
  durationMillis: 0,
};

export function enterReplayState(durationMillis: number): ReplayState {
  return {
    mode: "replay",
    playing: false,
    positionMillis: 0,
    durationMillis: Math.max(0, durationMillis),
  };
}

export function playReplayState(state: ReplayState): ReplayState {
  if (state.mode !== "replay") return state;
  return {
    ...state,
    playing: true,
    positionMillis:
      state.positionMillis >= state.durationMillis ? 0 : state.positionMillis,
  };
}

export function pauseReplayState(state: ReplayState, positionMillis: number) {
  return seekReplayState(state, positionMillis);
}

export function seekReplayState(
  state: ReplayState,
  positionMillis: number,
): ReplayState {
  if (state.mode !== "replay") return state;
  return {
    ...state,
    playing: false,
    positionMillis: Math.min(
      Math.max(0, positionMillis),
      state.durationMillis,
    ),
  };
}
