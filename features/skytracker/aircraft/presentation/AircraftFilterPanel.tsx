"use client";

import { useEffect, useRef } from "react";
import {
  countActiveAircraftFilters,
  isAircraftFilterActive,
  type AircraftFilterGroup,
  type AircraftFilterState,
  type AircraftFilterValue,
} from "../domain/aircraftFilters";

type AircraftFilterPanelProps = Readonly<{
  filters: AircraftFilterState;
  visibleCount: number;
  totalCount: number;
  onToggle: (group: AircraftFilterGroup, value: AircraftFilterValue) => void;
  onReset: () => void;
  onClose: () => void;
}>;

const FILTER_GROUPS: readonly Readonly<{
  label: string;
  group: AircraftFilterGroup;
  options: readonly Readonly<{ label: string; value: AircraftFilterValue }>[];
}>[] = [
  {
    label: "Aircraft type",
    group: "types",
    options: [
      { label: "Passenger", value: "passenger" },
      { label: "Cargo", value: "cargo" },
      { label: "Unknown", value: "unknown" },
    ],
  },
  {
    label: "Lifecycle",
    group: "lifecycles",
    options: [
      { label: "Fresh", value: "FRESH" },
      { label: "Stale", value: "STALE" },
    ],
  },
  {
    label: "Altitude",
    group: "altitudes",
    options: [
      { label: "On Ground", value: "on-ground" },
      { label: "Low · <3 km", value: "low" },
      { label: "Medium · 3–8 km", value: "medium" },
      { label: "High · >8 km", value: "high" },
    ],
  },
  {
    label: "Speed",
    group: "speeds",
    options: [
      { label: "Stationary", value: "stationary" },
      { label: "Slow", value: "slow" },
      { label: "Cruise", value: "cruise" },
    ],
  },
];

export function AircraftFilterPanel({
  filters,
  visibleCount,
  totalCount,
  onToggle,
  onReset,
  onClose,
}: AircraftFilterPanelProps) {
  const firstControlRef = useRef<HTMLButtonElement | null>(null);
  const activeCount = countActiveAircraftFilters(filters);

  useEffect(() => {
    firstControlRef.current?.focus();
  }, []);

  return (
    <aside
      id="aircraft-filter-panel"
      aria-label="Aircraft filters"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
      className="absolute right-3 top-3 z-30 max-h-[calc(100%-1.5rem)] w-[min(23rem,calc(100%-1.5rem))] overflow-y-auto rounded-[22px] border border-cyan-200/14 bg-[#07101b]/94 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.46)] backdrop-blur-xl sm:right-5 sm:top-5 lg:right-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/54">
            Discovery filters
          </p>
          <p aria-live="polite" className="mt-2 text-sm text-white/72">
            {visibleCount} of {totalCount} aircraft visible
          </p>
        </div>
        <button
          type="button"
          aria-label="Close aircraft filters"
          onClick={onClose}
          className="ol-interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </div>

      <div className="mt-4 space-y-4 border-t border-white/[0.07] pt-4">
        {FILTER_GROUPS.map((filterGroup, groupIndex) => (
          <fieldset key={filterGroup.group}>
            <legend className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
              {filterGroup.label}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {filterGroup.options.map((option, optionIndex) => {
                const active = isAircraftFilterActive(
                  filters,
                  filterGroup.group,
                  option.value,
                );
                return (
                  <button
                    key={option.value}
                    ref={
                      groupIndex === 0 && optionIndex === 0
                        ? firstControlRef
                        : undefined
                    }
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggle(filterGroup.group, option.value)}
                    className={`ol-interactive min-h-11 rounded-full border px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                      active
                        ? "border-cyan-200/30 bg-cyan-200/[0.12] text-cyan-50"
                        : "border-white/10 text-white/58 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
        <span className="text-xs text-white/38">
          {activeCount} active {activeCount === 1 ? "filter" : "filters"}
        </span>
        <button
          type="button"
          disabled={activeCount === 0}
          onClick={onReset}
          className="ol-interactive min-h-11 rounded-full border border-white/10 px-4 text-sm text-white/68 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-default disabled:opacity-35"
        >
          Reset filters
        </button>
      </div>
    </aside>
  );
}
