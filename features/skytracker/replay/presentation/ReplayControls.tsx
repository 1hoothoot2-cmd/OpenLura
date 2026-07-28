type ReplayControlsProps = {
  playing: boolean;
  positionMillis: number;
  durationMillis: number;
  onPlay: () => void;
  onPause: () => void;
  onBegin: () => void;
  onLive: () => void;
  onSeek: (positionMillis: number) => void;
};

export function ReplayControls({
  playing,
  positionMillis,
  durationMillis,
  onPlay,
  onPause,
  onBegin,
  onLive,
  onSeek,
}: ReplayControlsProps) {
  return (
    <section
      aria-label="Session replay controls"
      className="mt-5 border-t border-white/[0.07] pt-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-cyan-100/48">
            Session Replay
          </p>
          <p className="mt-1 text-xs text-white/44" aria-live="polite">
            {playing ? "Playing local session" : "Replay paused"}
          </p>
        </div>
        <button
          type="button"
          onClick={onLive}
          className="ol-interactive min-h-10 rounded-full border border-cyan-200/18 px-3 text-xs font-medium text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Live
        </button>
      </div>
      <label
        htmlFor="session-replay-position"
        className="mt-4 flex items-center justify-between gap-3 text-xs text-white/52"
      >
        <span>Replay position</span>
        <span className="font-mono text-white/66">
          {formatDuration(positionMillis)} / {formatDuration(durationMillis)}
        </span>
      </label>
      <input
        id="session-replay-position"
        type="range"
        min={0}
        max={Math.max(1, durationMillis)}
        step={100}
        value={Math.min(positionMillis, durationMillis)}
        aria-label="Session replay position"
        aria-valuetext={`${formatDuration(positionMillis)} of ${formatDuration(durationMillis)}`}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        className="ol-interactive mt-2 w-full accent-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ReplayButton label="Go to beginning" onClick={onBegin}>
          ⏮ Begin
        </ReplayButton>
        {playing ? (
          <ReplayButton label="Pause replay" onClick={onPause}>
            ⏸ Pause
          </ReplayButton>
        ) : (
          <ReplayButton label="Play replay" onClick={onPlay}>
            ▶ Play
          </ReplayButton>
        )}
        <ReplayButton label="Return to live" onClick={onLive}>
          ⏭ Live
        </ReplayButton>
      </div>
    </section>
  );
}

function ReplayButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="ol-interactive min-h-10 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-xs text-white/70 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      {children}
    </button>
  );
}

function formatDuration(valueMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(valueMillis / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
