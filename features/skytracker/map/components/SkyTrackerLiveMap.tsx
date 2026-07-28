"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MapLibreMap,
  setWorkerUrl,
  type ErrorEvent,
} from "maplibre-gl";
import type { Aircraft, AircraftId } from "../../aircraft/domain/aircraft";
import {
  updateFlightPhaseSessions,
  type FlightPhaseSessions,
} from "../../aircraft/domain/flightPhaseSession";
import {
  countActiveAircraftFilters,
  DEFAULT_AIRCRAFT_FILTERS,
  filterAircraft,
  toggleAircraftFilter,
  type AircraftFilterGroup,
  type AircraftFilterValue,
} from "../../aircraft/domain/aircraftFilters";
import {
  searchAircraft,
  type AircraftSearchResult,
} from "../../aircraft/domain/aircraftSearch";
import { AircraftFilterPanel } from "../../aircraft/presentation/AircraftFilterPanel";
import { aircraftDetailItems } from "../../aircraft/presentation/aircraftDetails";
import { FlightTimeline } from "../../aircraft/presentation/FlightTimeline";
import { createAircraftFeatureCollection } from "../../aircraft/presentation/aircraftGeoJson";
import { presentAircraft } from "../../aircraft/presentation/presentedAircraft";
import { normalizeViewportBounds } from "../../backend/domain/viewportBounds";
import { reconcileSnapshot } from "../../backend/domain/snapshotReconciliation";
import { fetchLiveAircraft } from "../../backend/infrastructure/liveAircraftClient";
import {
  MOVE_END_DEBOUNCE_MILLIS,
  REQUEST_TIMEOUT_MILLIS,
  ViewportPollingScheduler,
} from "../../backend/infrastructure/viewportPollingScheduler";
import {
  registerAircraftMapPresentation,
  type AircraftMapRegistration,
} from "../presentation/aircraftMapRenderer";
import {
  SKYTRACKER_INITIAL_CENTER,
  SKYTRACKER_INITIAL_ZOOM,
  SKYTRACKER_MAP_STYLE_URL,
  SKYTRACKER_MAX_ZOOM,
  SKYTRACKER_MIN_ZOOM,
  type SkyTrackerMapStyle,
} from "../infrastructure/mapConfig";
import { AircraftMotionRuntime } from "../infrastructure/aircraftMotionRuntime";
import { ReplayClock } from "../../aircraft/motion/replayClock";
import {
  shouldUpdateFollowCamera,
  type FollowCameraSample,
} from "../domain/followCameraPolicy";
import type { AirportDetails } from "../../airports/domain/airport";
import {
  searchAirports,
  type AirportSearchResult,
} from "../../airports/domain/airportSearch";
import { createAirportMapFocus } from "../../airports/domain/airportMapPolicy";
import {
  DEVELOPMENT_AIRPORTS,
  developmentAirportDetails,
} from "../../airports/fixtures/developmentAirports";
import { AirportDetailPanel } from "../../airports/presentation/AirportDetailPanel";
import {
  EMPTY_FAVORITES,
  favoriteAircraftSnapshot,
  favoriteAirportSnapshot,
  type FavoriteAirport,
  type SkyTrackerFavorites,
} from "../../favorites/domain/favorites";
import {
  searchFavorites,
  type FavoriteSearchResult,
} from "../../favorites/domain/favoriteSearch";
import {
  createBrowserFavoritesRepository,
  type FavoritesRepository,
} from "../../favorites/infrastructure/favoritesRepository";
import {
  enterReplayState,
  LIVE_REPLAY_STATE,
  pauseReplayState,
  playReplayState,
  seekReplayState,
  type ReplayState,
} from "../../replay/domain/replayState";
import {
  recordedFrameToAircraft,
  replayFrameAt,
  SessionRecorder,
  type RecordedSessionFrame,
} from "../../replay/domain/sessionRecorder";
import { ReplayControls } from "../../replay/presentation/ReplayControls";
import type { HistoricalTrack } from "../../historical-track/domain/historicalTrack";
import { fetchHistoricalTrackForAircraft } from "../../historical-track/infrastructure/historicalTrackClient";
import {
  createHistoricalTrackFeatureCollection,
  type HistoricalTrackFeatureCollection,
} from "../../historical-track/presentation/historicalTrackGeoJson";
import {
  registerHistoricalTrackMapPresentation,
  type HistoricalTrackMapRegistration,
} from "../../historical-track/presentation/historicalTrackMapRenderer";

type MapStatus = "loading" | "ready" | "error";

const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

type BackendStatus = Readonly<{
  state: "not-configured" | "connecting" | "connected" | "reconnecting" | "invalid-viewport";
  aircraftCount: number;
  updatedAt: number | null;
  cacheStatus: string | null;
}>;

type SkyTrackerLiveMapProps = {
  initialAircraftId?: string | null;
};

type MapFocusRequest =
  | Readonly<{ aircraftId: AircraftId; requestId: number }>
  | Readonly<{
      longitudeDegrees: number;
      latitudeDegrees: number;
      requestId: number;
    }>;

type SearchTab = "aircraft" | "airports" | "favorites";

type HistoricalTrackState =
  | Readonly<{ status: "idle" | "loading" | "unavailable" }>
  | Readonly<{ status: "ready"; track: HistoricalTrack }>;

export function SkyTrackerLiveMap({
  initialAircraftId = null,
}: SkyTrackerLiveMapProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [bearing, setBearing] = useState(0);
  const [aircraft, setAircraft] = useState<readonly Aircraft[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    state: "connecting",
    aircraftCount: 0,
    updatedAt: null,
    cacheStatus: null,
  });
  const [selectedAircraftId, setSelectedAircraftId] =
    useState<AircraftId | null>(null);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<SearchTab>("aircraft");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_AIRCRAFT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [mapFocusRequest, setMapFocusRequest] =
    useState<MapFocusRequest | null>(null);
  const [selectedAirport, setSelectedAirport] =
    useState<AirportDetails | null>(null);
  const [favorites, setFavorites] =
    useState<SkyTrackerFavorites>(EMPTY_FAVORITES);
  const [favoriteAnnouncement, setFavoriteAnnouncement] = useState("");
  const [flightPhaseSessions, setFlightPhaseSessions] =
    useState<FlightPhaseSessions>(() => new Map());
  const [recorder] = useState(() => new SessionRecorder());
  const [replayClock] = useState(
    () => new ReplayClock(() => performance.now()),
  );
  const [recordingDurationMillis, setRecordingDurationMillis] = useState(0);
  const [replayState, setReplayState] =
    useState<ReplayState>(LIVE_REPLAY_STATE);
  const [historicalTrackState, setHistoricalTrackState] =
    useState<HistoricalTrackState>({ status: "idle" });
  const mapRef = useRef<MapLibreMap | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchRequestIdRef = useRef(0);
  const favoritesRepositoryRef = useRef<FavoritesRepository | null>(null);
  const currentAircraftRef = useRef<readonly Aircraft[]>([]);
  const latestLiveAircraftRef = useRef<readonly Aircraft[]>([]);
  const livePhaseSessionsRef = useRef<FlightPhaseSessions>(new Map());
  const replayFramesRef = useRef<readonly RecordedSessionFrame[]>([]);
  const replayModeRef = useRef<ReplayState["mode"]>("live");
  const initialSelectionAttemptedRef = useRef(false);
  const selectedAircraftIdRef = useRef<AircraftId | null>(null);

  useEffect(() => {
    currentAircraftRef.current = aircraft;
  }, [aircraft]);

  useEffect(() => {
    selectedAircraftIdRef.current = selectedAircraftId;
  }, [selectedAircraftId]);

  useEffect(() => {
    replayModeRef.current = replayState.mode;
  }, [replayState.mode]);

  useEffect(() => {
    const repository = createBrowserFavoritesRepository();
    favoritesRepositoryRef.current = repository;
    let active = true;
    queueMicrotask(() => {
      if (active) setFavorites(repository.load());
    });
    return () => {
      active = false;
    };
  }, []);

  const favoriteAircraftIds = useMemo(
    () => new Set(favorites.aircraft.map((item) => item.aircraftId)),
    [favorites.aircraft],
  );
  const presentedAircraft = useMemo(
    () =>
      presentAircraft(
        aircraft,
        selectedAircraftId,
        favoriteAircraftIds,
      ),
    [aircraft, favoriteAircraftIds, selectedAircraftId],
  );
  const aircraftFeatures = useMemo(
    () => createAircraftFeatureCollection(presentedAircraft),
    [presentedAircraft],
  );
  const searchResults = useMemo(
    () => searchAircraft(aircraft, searchQuery),
    [aircraft, searchQuery],
  );
  const airportSearchResults = useMemo(
    () => searchAirports(DEVELOPMENT_AIRPORTS, searchQuery),
    [searchQuery],
  );
  const favoriteSearchResults = useMemo(
    () => searchFavorites(favorites, searchQuery),
    [favorites, searchQuery],
  );
  const visibleAircraft = useMemo(
    () => filterAircraft(aircraft, filters),
    [aircraft, filters],
  );
  const visibleAircraftIds = useMemo(
    () => visibleAircraft.map((item) => item.id),
    [visibleAircraft],
  );
  const visibleAircraftIdSet = useMemo(
    () => new Set<AircraftId>(visibleAircraftIds),
    [visibleAircraftIds],
  );
  const activeFilterCount = countActiveAircraftFilters(filters);
  const activeSearchResultsLength =
    searchTab === "aircraft"
      ? searchResults.length
      : searchTab === "airports"
        ? airportSearchResults.length
        : favoriteSearchResults.length;
  const boundedActiveSearchIndex = Math.min(
    activeSearchIndex,
    Math.max(0, activeSearchResultsLength - 1),
  );
  const selectedAircraft = aircraft.find((item) => item.id === selectedAircraftId) ?? null;
  const selectedPresentedAircraft =
    presentedAircraft.find((item) => item.selected) ?? null;
  const selectedFlightPhaseSession = selectedAircraftId
    ? flightPhaseSessions.get(selectedAircraftId) ?? null
    : null;
  const historicalTrackFeatures = useMemo(
    () =>
      createHistoricalTrackFeatureCollection(
        historicalTrackState.status === "ready" &&
          historicalTrackState.track.aircraftId === selectedAircraftId
          ? historicalTrackState.track
          : null,
      ),
    [historicalTrackState, selectedAircraftId],
  );

  useEffect(() => {
    let active = true;
    const publish = (state: HistoricalTrackState) => {
      queueMicrotask(() => {
        if (active) setHistoricalTrackState(state);
      });
    };
    if (!selectedAircraftId) {
      publish({ status: "idle" });
      return () => {
        active = false;
      };
    }
    const selected = currentAircraftRef.current.find(
      (item) => item.id === selectedAircraftId,
    );
    if (!selected) {
      publish({ status: "unavailable" });
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    publish({ status: "loading" });
    void fetchHistoricalTrackForAircraft(
      selected,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted || !active) return;
        setHistoricalTrackState(
          result.ok
            ? { status: "ready", track: result.track }
            : { status: "unavailable" },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted && active) {
          setHistoricalTrackState({ status: "unavailable" });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedAircraftId]);

  const selectAircraft = useCallback((aircraftId: AircraftId | null) => {
    const validSelection =
      aircraftId &&
      currentAircraftRef.current.some((item) => item.id === aircraftId)
        ? aircraftId
        : null;
    if (validSelection !== selectedAircraftIdRef.current) setFollowEnabled(false);
    if (validSelection) setSelectedAirport(null);
    setSelectedAircraftId(validSelection);
    updateAircraftQuery(validSelection);
  }, []);

  const acceptSnapshot = useCallback((nextAircraft: readonly Aircraft[], nextStatus: BackendStatus) => {
    recorder.record(nextStatus.updatedAt ?? Date.now(), nextAircraft);
    setRecordingDurationMillis(recorder.durationMillis);
    latestLiveAircraftRef.current = nextAircraft;
    const nextLiveSessions = updateFlightPhaseSessions(
      livePhaseSessionsRef.current,
      nextAircraft,
    );
    livePhaseSessionsRef.current = nextLiveSessions;
    setBackendStatus(nextStatus);
    if (replayModeRef.current === "replay") return;

    setFlightPhaseSessions(nextLiveSessions);
    setAircraft([...nextAircraft]);
    if (
      selectedAircraftIdRef.current &&
      !nextAircraft.some((item) => item.id === selectedAircraftIdRef.current)
    ) {
      setFollowEnabled(false);
    }
    setSelectedAircraftId((current) => {
      if (!initialSelectionAttemptedRef.current) {
        initialSelectionAttemptedRef.current = true;
        const requestedId = initialAircraftId?.trim().toLowerCase();
        const initialMatch = nextAircraft.find((item) => item.id === requestedId);
        if (initialMatch) return initialMatch.id;
      }
      const reconciled = reconcileSnapshot(nextAircraft, current);
      if (!reconciled.selectionRemoved) return current;
      updateAircraftQuery(null);
      return null;
    });
  }, [initialAircraftId, recorder]);

  const applyReplayPosition = useCallback(
    (positionMillis: number, resetTimeline: boolean) => {
      const frame = replayFrameAt(replayFramesRef.current, positionMillis);
      if (!frame) return;
      const replayAircraft = recordedFrameToAircraft(
        frame,
        latestLiveAircraftRef.current,
      );
      setAircraft(replayAircraft);
      setFlightPhaseSessions((current) =>
        updateFlightPhaseSessions(
          resetTimeline ? new Map() : current,
          replayAircraft,
        ),
      );
    },
    [],
  );

  const enterReplay = useCallback(() => {
    const frames = recorder.snapshot();
    if (frames.length < 2 || recorder.durationMillis <= 0) return;
    replayFramesRef.current = frames;
    replayModeRef.current = "replay";
    replayClock.pause();
    replayClock.seek(0);
    setFollowEnabled(false);
    setReplayState(enterReplayState(recorder.durationMillis));
    applyReplayPosition(0, true);
  }, [applyReplayPosition, recorder, replayClock]);

  const pauseReplay = useCallback(() => {
    replayClock.pause();
    setReplayState((current) =>
      pauseReplayState(current, replayClock.currentTime()),
    );
  }, [replayClock]);

  const playReplay = useCallback(() => {
    setReplayState((current) => {
      if (current.positionMillis >= current.durationMillis) replayClock.seek(0);
      replayClock.play();
      return playReplayState(current);
    });
  }, [replayClock]);

  const seekReplay = useCallback(
    (positionMillis: number) => {
      replayClock.pause();
      replayClock.seek(positionMillis);
      setReplayState((current) => seekReplayState(current, positionMillis));
      applyReplayPosition(positionMillis, true);
    },
    [applyReplayPosition, replayClock],
  );

  const returnToLive = useCallback(() => {
    replayClock.pause();
    replayModeRef.current = "live";
    setReplayState(LIVE_REPLAY_STATE);
    setAircraft([...latestLiveAircraftRef.current]);
    setFlightPhaseSessions(livePhaseSessionsRef.current);
  }, [replayClock]);

  useEffect(() => {
    if (replayState.mode !== "replay" || !replayState.playing) return;
    let frameHandle = 0;
    let lastPresentationUpdate = Number.NEGATIVE_INFINITY;
    const update = () => {
      const positionMillis = Math.min(
        replayClock.currentTime(),
        replayState.durationMillis,
      );
      if (
        positionMillis - lastPresentationUpdate >= 200 ||
        positionMillis >= replayState.durationMillis
      ) {
        lastPresentationUpdate = positionMillis;
        applyReplayPosition(positionMillis, false);
        setReplayState((current) => ({
          ...current,
          positionMillis,
          playing: positionMillis < current.durationMillis,
        }));
      }
      if (positionMillis >= replayState.durationMillis) {
        replayClock.pause();
        return;
      }
      frameHandle = window.requestAnimationFrame(update);
    };
    frameHandle = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frameHandle);
  }, [
    applyReplayPosition,
    replayClock,
    replayState.durationMillis,
    replayState.mode,
    replayState.playing,
  ]);

  const stopFollowing = useCallback(() => setFollowEnabled(false), []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setActiveSearchIndex(0);
  }, []);

  const closeFilters = useCallback(() => {
    setFiltersOpen(false);
    window.requestAnimationFrame(() => filtersButtonRef.current?.focus());
  }, []);

  const toggleFilter = useCallback(
    (group: AircraftFilterGroup, value: AircraftFilterValue) => {
      setFilters((current) => toggleAircraftFilter(current, group, value));
    },
    [],
  );

  const selectSearchResult = useCallback(
    (result: AircraftSearchResult) => {
      if (!currentAircraftRef.current.some((item) => item.id === result.aircraft.id)) {
        return;
      }
      setFollowEnabled(false);
      selectAircraft(result.aircraft.id);
      searchRequestIdRef.current += 1;
      setMapFocusRequest({
        aircraftId: result.aircraft.id,
        requestId: searchRequestIdRef.current,
      });
      closeSearch();
    },
    [closeSearch, selectAircraft],
  );

  const selectAirportSearchResult = useCallback(
    (result: AirportSearchResult) => {
      setSelectedAirport(developmentAirportDetails(result.entry));
      closeSearch();
    },
    [closeSearch],
  );

  const selectFavoriteSearchResult = useCallback(
    (result: FavoriteSearchResult) => {
      if (result.kind === "airport") {
        setSelectedAirport(favoriteAirportDetails(result.favorite));
        closeSearch();
        return;
      }
      const current = currentAircraftRef.current.find(
        (item) => item.id === result.favorite.aircraftId,
      );
      if (!current) return;
      selectSearchResult({
        aircraft: current,
        matchedField: "aircraftId",
        matchType: "exact",
      });
    },
    [closeSearch, selectSearchResult],
  );

  const toggleSelectedAircraftFavorite = useCallback(() => {
    if (!selectedAircraft || !favoritesRepositoryRef.current) return;
    const wasFavorite = favoriteAircraftIds.has(selectedAircraft.id);
    setFavorites(
      favoritesRepositoryRef.current.toggleAircraft(
        favoriteAircraftSnapshot(selectedAircraft),
      ),
    );
    setFavoriteAnnouncement(
      wasFavorite
        ? "Aircraft removed from favorites"
        : "Aircraft added to favorites",
    );
  }, [favoriteAircraftIds, selectedAircraft]);

  const toggleSelectedAirportFavorite = useCallback(() => {
    if (!selectedAirport || !favoritesRepositoryRef.current) return;
    const icaoCode = selectedAirport.airport.icaoCode;
    if (!icaoCode) return;
    const wasFavorite = favorites.airports.some(
      (item) => item.icaoCode === icaoCode,
    );
    setFavorites(
      favoritesRepositoryRef.current.toggleAirport(
        favoriteAirportSnapshot(selectedAirport),
      ),
    );
    setFavoriteAnnouncement(
      wasFavorite
        ? "Airport removed from favorites"
        : "Airport added to favorites",
    );
  }, [favorites.airports, selectedAirport]);

  const showSelectedAirportOnMap = useCallback(() => {
    if (!selectedAirport) return;
    const focus = createAirportMapFocus(selectedAirport);
    if (focus.stopFollowing) setFollowEnabled(false);
    searchRequestIdRef.current += 1;
    setMapFocusRequest({
      longitudeDegrees: focus.longitudeDegrees,
      latitudeDegrees: focus.latitudeDegrees,
      requestId: searchRequestIdRef.current,
    });
  }, [selectedAirport]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const retryMap = useCallback(() => {
    setStatus("loading");
    setBearing(0);
    setRetryKey((current) => current + 1);
  }, []);

  return (
    <main className="relative isolate flex h-dvh min-h-[520px] w-full flex-col overflow-hidden bg-[#030711] text-white">
      <h1 className="sr-only">SkyTracker aircraft map preview</h1>

      <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#040711]/88 px-3 backdrop-blur-xl sm:px-5 lg:px-7">
        <Link
          href="/skytracker"
          className="ol-interactive flex min-h-11 items-center gap-2.5 rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label="Back to the SkyTracker product page"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-cyan-300/15 bg-cyan-300/[0.045]">
            <Image
              src="/openlura-logo.png"
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-contain"
              priority
            />
          </span>
          <span className="text-sm font-semibold tracking-[-0.02em] text-white/92">
            <span className="hidden text-white/44 sm:inline">OpenLura / </span>
            SkyTracker
          </span>
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label={searchOpen ? "Close aircraft search" : "Search aircraft"}
            aria-expanded={searchOpen}
            onClick={() => {
              if (searchOpen) closeSearch();
              else {
                setFiltersOpen(false);
                setSearchOpen(true);
              }
            }}
            className="ol-interactive flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/66 hover:border-cyan-200/20 hover:bg-cyan-200/[0.06] hover:text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
              {searchOpen ? (
                <path d="m7 7 10 10M17 7 7 17" />
              ) : (
                <>
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </>
              )}
            </svg>
          </button>
          <button
            ref={filtersButtonRef}
            type="button"
            aria-label={
              activeFilterCount === 0
                ? "Open aircraft filters"
                : `Open aircraft filters, ${activeFilterCount} active`
            }
            aria-controls="aircraft-filter-panel"
            aria-expanded={filtersOpen}
            onClick={() => {
              if (filtersOpen) closeFilters();
              else {
                closeSearch();
                setFiltersOpen(true);
              }
            }}
            className="ol-interactive relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/66 hover:border-cyan-200/20 hover:bg-cyan-200/[0.06] hover:text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M7 12h10M10 17h4" />
            </svg>
            {activeFilterCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#07101b] bg-cyan-300 px-1 text-[10px] font-bold text-[#041019]"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            disabled={recordingDurationMillis <= 0}
            aria-label={
              replayState.mode === "replay"
                ? "Return to live aircraft"
                : "Open session replay"
            }
            aria-pressed={replayState.mode === "replay"}
            onClick={
              replayState.mode === "replay" ? returnToLive : enterReplay
            }
            className="ol-interactive min-h-11 rounded-full border border-cyan-200/14 px-3 text-xs font-semibold uppercase tracking-[0.11em] text-cyan-100/70 hover:bg-cyan-200/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {replayState.mode === "replay" ? "Live" : "Replay"}
          </button>
          <span className="hidden min-h-8 items-center gap-2 rounded-full border border-cyan-200/12 bg-cyan-200/[0.045] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/62 sm:inline-flex">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.55)]"
            />
            {replayState.mode === "replay"
              ? "Local session replay"
              : "Backend development data"}
          </span>
          <Link
            href="/skytracker"
            className="ol-interactive hidden min-h-11 items-center rounded-full border border-white/10 px-4 text-sm text-white/58 hover:border-white/18 hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:inline-flex"
          >
            Product page
          </Link>
        </div>
      </header>

      <section
        aria-label="Interactive SkyTracker map using local backend development data. Select an aircraft on the map, or use the clear selection button after selecting one."
        className="relative min-h-0 flex-1"
      >
        <MapViewport
          key={retryKey}
          mapRef={mapRef}
          style={SKYTRACKER_MAP_STYLE_URL}
          status={status}
          bearing={bearing}
          aircraftFeatures={aircraftFeatures}
          historicalTrackFeatures={historicalTrackFeatures}
          aircraft={aircraft}
          favoriteAircraftIds={favoriteAircraftIds}
          visibleAircraftIds={visibleAircraftIds}
          selectedAircraftId={selectedAircraftId}
          followEnabled={followEnabled}
          mapFocusRequest={mapFocusRequest}
          backendStatus={backendStatus}
          replayMode={replayState.mode === "replay"}
          onBackendStatusChange={setBackendStatus}
          onSnapshot={acceptSnapshot}
          onStatusChange={setStatus}
          onBearingChange={setBearing}
          onSelectAircraft={selectAircraft}
          onFollowStopped={stopFollowing}
          onRetry={retryMap}
        />

        {searchOpen && (
          <aside
            aria-label="SkyTracker search"
            className="absolute left-3 top-3 z-30 w-[min(28rem,calc(100%-1.5rem))] rounded-[22px] border border-cyan-200/14 bg-[#07101b]/92 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.44)] backdrop-blur-xl sm:left-5 sm:top-5 sm:p-4 lg:left-7"
          >
            <div
              className="flex rounded-xl border border-white/[0.08] bg-black/15 p-1"
              role="tablist"
              aria-label="Search category"
            >
              {(["aircraft", "airports", "favorites"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`search-${tab}-tab`}
                  aria-selected={searchTab === tab}
                  aria-controls="skytracker-search-results"
                  onClick={() => {
                    setSearchTab(tab);
                    setActiveSearchIndex(0);
                    window.requestAnimationFrame(() =>
                      searchInputRef.current?.focus(),
                    );
                  }}
                  className={`ol-interactive min-h-10 flex-1 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                    searchTab === tab
                      ? "bg-cyan-200/[0.1] text-cyan-50"
                      : "text-white/46 hover:bg-white/[0.04] hover:text-white/76"
                  }`}
                >
                  {tab === "aircraft"
                    ? "Aircraft"
                    : tab === "airports"
                      ? "Airports"
                      : "Favorites"}
                </button>
              ))}
            </div>
            <label
              htmlFor="skytracker-search"
              className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/54"
            >
              Search {searchTab}
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={searchInputRef}
                id="skytracker-search"
                type="search"
                value={searchQuery}
                autoComplete="off"
                spellCheck={false}
                aria-controls="skytracker-search-results"
                aria-activedescendant={
                  activeSearchResultsLength > 0
                    ? `skytracker-search-result-${boundedActiveSearchIndex}`
                    : undefined
                }
                placeholder={
                  searchTab === "aircraft"
                    ? "Callsign, registration or aircraft ID"
                    : searchTab === "airports"
                      ? "ICAO, IATA, airport name or city"
                      : "Search saved favorites"
                }
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveSearchIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeSearch();
                    return;
                  }
                  if (!searchQuery.trim() || activeSearchResultsLength === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveSearchIndex((current) =>
                      Math.min(
                        Math.min(current, activeSearchResultsLength - 1) + 1,
                        activeSearchResultsLength - 1,
                      ),
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveSearchIndex(
                      Math.max(boundedActiveSearchIndex - 1, 0),
                    );
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (searchTab === "aircraft") {
                      const result = searchResults[boundedActiveSearchIndex];
                      if (result) selectSearchResult(result);
                    } else if (searchTab === "airports") {
                      const result =
                        airportSearchResults[boundedActiveSearchIndex];
                      if (result) selectAirportSearchResult(result);
                    } else {
                      const result =
                        favoriteSearchResults[boundedActiveSearchIndex];
                      if (result) selectFavoriteSearchResult(result);
                    }
                  }
                }}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-cyan-200/28 focus:ring-2 focus:ring-cyan-300/35"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="ol-interactive min-h-11 rounded-xl border border-white/10 px-3 text-sm text-white/58 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Close
              </button>
            </div>

            {(searchTab === "favorites" || searchQuery.trim()) && (
              <div
                id="skytracker-search-results"
                role="listbox"
                aria-label={`${searchTab === "aircraft" ? "Aircraft" : "Airport"} search results`}
                aria-labelledby={`search-${searchTab}-tab`}
                className="mt-3 max-h-[min(48vh,22rem)] overflow-y-auto border-t border-white/[0.07] pt-2"
              >
                {activeSearchResultsLength === 0 ? (
                  <p role="status" className="px-2 py-4 text-sm text-white/46">
                    {searchTab === "favorites"
                      ? "No favorites saved yet"
                      : `No matching ${searchTab === "aircraft" ? "aircraft" : "airports"} found`}
                  </p>
                ) : searchTab === "aircraft" ? (
                  searchResults.map((result, index) => (
                    <button
                      key={result.aircraft.id}
                      id={`skytracker-search-result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === boundedActiveSearchIndex}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onClick={() => selectSearchResult(result)}
                      className={`ol-interactive flex min-h-14 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 ${
                        index === boundedActiveSearchIndex
                          ? "bg-cyan-200/[0.09]"
                          : "hover:bg-white/[0.045]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white/88">
                          {result.aircraft.callsign?.trim() ||
                            result.aircraft.registration?.trim() ||
                            result.aircraft.id.toUpperCase()}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/42">
                          {result.aircraft.registration?.trim() || "Registration unknown"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-cyan-100/46">
                        {result.aircraft.id}
                      </span>
                    </button>
                  ))
                ) : searchTab === "airports" ? (
                  airportSearchResults.map((result, index) => (
                    <button
                      key={result.entry.airport.icaoCode ?? result.entry.airport.iataCode}
                      id={`skytracker-search-result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === boundedActiveSearchIndex}
                      onMouseEnter={() => setActiveSearchIndex(index)}
                      onClick={() => selectAirportSearchResult(result)}
                      className={`ol-interactive flex min-h-16 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 ${
                        index === boundedActiveSearchIndex
                          ? "bg-cyan-200/[0.09]"
                          : "hover:bg-white/[0.045]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white/88">
                          {result.entry.airport.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/42">
                          {[result.entry.city, countryName(result.entry.airport.countryCode)]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.08em] text-cyan-100/56">
                        {result.entry.airport.iataCode}
                        <span className="block text-white/32">
                          {result.entry.airport.icaoCode}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  favoriteSearchResults.map((result, index) => (
                    <FavoriteSearchOption
                      key={
                        result.kind === "aircraft"
                          ? `aircraft-${result.favorite.aircraftId}`
                          : `airport-${result.favorite.icaoCode}`
                      }
                      result={result}
                      index={index}
                      active={index === boundedActiveSearchIndex}
                      currentAircraft={aircraft}
                      onActivate={() => selectFavoriteSearchResult(result)}
                      onHover={() => setActiveSearchIndex(index)}
                    />
                  ))
                )}
              </div>
            )}
          </aside>
        )}

        {filtersOpen && (
          <AircraftFilterPanel
            filters={filters}
            visibleCount={visibleAircraft.length}
            totalCount={aircraft.length}
            onToggle={toggleFilter}
            onReset={() => setFilters(DEFAULT_AIRCRAFT_FILTERS)}
            onClose={closeFilters}
          />
        )}

        {selectedAirport && (
          <AirportDetailPanel
            details={selectedAirport}
            favorite={favorites.airports.some(
              (item) =>
                item.icaoCode === selectedAirport.airport.icaoCode,
            )}
            onClose={() => setSelectedAirport(null)}
            onToggleFavorite={toggleSelectedAirportFavorite}
            onShowOnMap={showSelectedAirportOnMap}
          />
        )}

        {!selectedAirport && selectedAircraft && selectedPresentedAircraft && (
          <aside
            aria-live="polite"
            aria-label={`${selectedPresentedAircraft.displayCallsign} aircraft details`}
            className="absolute bottom-3 left-3 z-20 max-h-[min(70vh,38rem)] w-[min(25rem,calc(100%-1.5rem))] overflow-y-auto rounded-[22px] border border-amber-200/18 bg-[#0a111c]/90 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:bottom-5 sm:left-5 sm:w-[24rem] sm:p-5 lg:left-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/62">
                  Selected aircraft
                </p>
                <p className="mt-2 truncate text-base font-semibold text-white/92">
                  {selectedPresentedAircraft.displayCallsign}
                </p>
                {selectedAircraft.registration && (
                  <p className="mt-1 text-sm text-white/48">
                    {selectedAircraft.registration}
                  </p>
                )}
              </div>
              <span
                aria-hidden="true"
                className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-amber-200 bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.65)]"
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.07] pt-4">
              {aircraftDetailItems(selectedAircraft).map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/36">
                    {item.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-white/76">{item.value}</dd>
                </div>
              ))}
            </dl>
            {selectedFlightPhaseSession && (
              <FlightTimeline
                aircraft={selectedAircraft}
                session={selectedFlightPhaseSession}
              />
            )}
            <section
              aria-live="polite"
              aria-label="Historical track status"
              className="mt-4 border-t border-white/[0.07] pt-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/48">
                Historical track
              </p>
              {historicalTrackState.status === "loading" ? (
                <p className="mt-1.5 text-sm text-cyan-100/68">
                  Loading historical track…
                </p>
              ) : historicalTrackState.status === "ready" &&
                historicalTrackState.track.aircraftId === selectedAircraft.id ? (
                <p className="mt-1.5 text-sm text-white/68">
                  {historicalTrackState.track.completeness.toLowerCase()} ·{" "}
                  {historicalTrackState.track.points.length} points ·{" "}
                  {historicalTrackState.track.segments.length}{" "}
                  {historicalTrackState.track.segments.length === 1
                    ? "segment"
                    : "segments"}
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-white/48">
                  No historical track available.
                </p>
              )}
            </section>
            {replayState.mode === "replay" && (
              <ReplayControls
                playing={replayState.playing}
                positionMillis={replayState.positionMillis}
                durationMillis={replayState.durationMillis}
                onPlay={playReplay}
                onPause={pauseReplay}
                onBegin={() => seekReplay(0)}
                onLive={returnToLive}
                onSeek={seekReplay}
              />
            )}
            {!visibleAircraftIdSet.has(selectedAircraft.id) && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-amber-200/14 bg-amber-200/[0.07] px-3 py-2 text-xs leading-5 text-amber-100/72"
              >
                This aircraft is currently hidden by active filters. Details and
                Follow remain available.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
              <button
                type="button"
                aria-pressed={favoriteAircraftIds.has(selectedAircraft.id)}
                aria-label={
                  favoriteAircraftIds.has(selectedAircraft.id)
                    ? "Remove aircraft from favorites"
                    : "Add aircraft to favorites"
                }
                onClick={toggleSelectedAircraftFavorite}
                className="ol-interactive min-h-11 rounded-full border border-amber-200/18 bg-amber-200/[0.06] px-4 text-sm font-medium text-amber-100 hover:bg-amber-200/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {favoriteAircraftIds.has(selectedAircraft.id)
                  ? "★ Favorite"
                  : "☆ Add Favorite"}
              </button>
              <button
                type="button"
                aria-pressed={followEnabled}
                onClick={() => setFollowEnabled((current) => !current)}
                className="ol-interactive min-h-11 rounded-full border border-cyan-200/18 bg-cyan-200/[0.07] px-4 text-sm font-medium text-cyan-50 hover:bg-cyan-200/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {followEnabled ? "Stop following" : "Follow aircraft"}
              </button>
              <button
                type="button"
                onClick={() => selectAircraft(null)}
                className="ol-interactive min-h-11 rounded-full border border-white/10 px-4 text-sm text-white/68 hover:border-white/18 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Clear selection
              </button>
            </div>
          </aside>
        )}
        <p className="sr-only" aria-live="polite">
          {favoriteAnnouncement}
        </p>
      </section>
    </main>
  );
}

type MapViewportProps = {
  mapRef: React.MutableRefObject<MapLibreMap | null>;
  style: SkyTrackerMapStyle;
  status: MapStatus;
  bearing: number;
  aircraftFeatures: ReturnType<typeof createAircraftFeatureCollection>;
  historicalTrackFeatures: HistoricalTrackFeatureCollection;
  aircraft: readonly Aircraft[];
  favoriteAircraftIds: ReadonlySet<string>;
  visibleAircraftIds: readonly AircraftId[];
  selectedAircraftId: AircraftId | null;
  followEnabled: boolean;
  mapFocusRequest: MapFocusRequest | null;
  backendStatus: BackendStatus;
  replayMode: boolean;
  onBackendStatusChange: (status: BackendStatus) => void;
  onSnapshot: (aircraft: readonly Aircraft[], status: BackendStatus) => void;
  onStatusChange: (status: MapStatus) => void;
  onBearingChange: (bearing: number) => void;
  onSelectAircraft: (aircraftId: AircraftId | null) => void;
  onFollowStopped: () => void;
  onRetry: () => void;
};

function MapViewport({
  mapRef,
  style,
  status,
  bearing,
  aircraftFeatures,
  historicalTrackFeatures,
  aircraft,
  favoriteAircraftIds,
  visibleAircraftIds,
  selectedAircraftId,
  followEnabled,
  mapFocusRequest,
  backendStatus,
  replayMode,
  onBackendStatusChange,
  onSnapshot,
  onStatusChange,
  onBearingChange,
  onSelectAircraft,
  onFollowStopped,
  onRetry,
}: MapViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const registrationRef = useRef<AircraftMapRegistration | null>(null);
  const historicalTrackRegistrationRef =
    useRef<HistoricalTrackMapRegistration | null>(null);
  const motionRuntimeRef = useRef<AircraftMotionRuntime | null>(null);
  const aircraftFeaturesRef = useRef(aircraftFeatures);
  const historicalTrackFeaturesRef = useRef(historicalTrackFeatures);
  const selectedAircraftIdRef = useRef(selectedAircraftId);
  const aircraftRef = useRef(aircraft);
  const favoriteAircraftIdsRef = useRef(favoriteAircraftIds);
  const visibleAircraftIdsRef = useRef(visibleAircraftIds);
  const schedulerRef = useRef<ViewportPollingScheduler | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const moveDebounceRef = useRef<number | null>(null);
  const followEnabledRef = useRef(followEnabled);
  const lastFollowSampleRef = useRef<FollowCameraSample | null>(null);
  const followMoveRef = useRef(false);
  const motionAircraftRef = useRef<readonly Aircraft[]>(aircraft);

  useEffect(() => {
    aircraftFeaturesRef.current = aircraftFeatures;
    selectedAircraftIdRef.current = selectedAircraftId;
    motionRuntimeRef.current?.setSelectedAircraftId(selectedAircraftId);
  }, [aircraftFeatures, selectedAircraftId]);

  useEffect(() => {
    historicalTrackFeaturesRef.current = historicalTrackFeatures;
    historicalTrackRegistrationRef.current?.write(historicalTrackFeatures);
  }, [historicalTrackFeatures]);

  useEffect(() => {
    followEnabledRef.current = followEnabled;
    if (!followEnabled) lastFollowSampleRef.current = null;
  }, [followEnabled]);

  useEffect(() => {
    aircraftRef.current = aircraft;
    motionAircraftRef.current = aircraft;
    motionRuntimeRef.current?.setAircraftSnapshot(aircraft);
  }, [aircraft]);

  useEffect(() => {
    favoriteAircraftIdsRef.current = favoriteAircraftIds;
    motionRuntimeRef.current?.setFavoriteAircraftIds(favoriteAircraftIds);
  }, [favoriteAircraftIds]);

  useEffect(() => {
    visibleAircraftIdsRef.current = visibleAircraftIds;
    registrationRef.current?.setVisibleAircraftIds(visibleAircraftIds);
  }, [visibleAircraftIds]);

  useEffect(() => {
    if (!mapFocusRequest || !mapRef.current) return;
    const target =
      "aircraftId" in mapFocusRequest
        ? motionAircraftRef.current.find(
            (item) => item.id === mapFocusRequest.aircraftId,
          ) ??
          aircraftRef.current.find(
            (item) => item.id === mapFocusRequest.aircraftId,
          )
        : mapFocusRequest;
    if (!target) return;
    followMoveRef.current = true;
    mapRef.current.easeTo({
      center: [
        target.longitudeDegrees,
        target.latitudeDegrees,
      ],
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 450,
      essential: false,
    });
  }, [mapFocusRequest, mapRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let styleReady = false;
    let resizeFrame: number | null = null;
    let disposed = false;

    setWorkerUrl(MAPLIBRE_WORKER_URL);
    const map = new MapLibreMap({
      container,
      style,
      center: SKYTRACKER_INITIAL_CENTER,
      zoom: SKYTRACKER_INITIAL_ZOOM,
      minZoom: SKYTRACKER_MIN_ZOOM,
      maxZoom: SKYTRACKER_MAX_ZOOM,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      dragRotate: true,
      touchPitch: false,
      cooperativeGestures: false,
    });

    mapRef.current = map;
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    const requestViewport = async () => {
      if (disposed || document.hidden) return false;
      const mapBounds = map.getBounds();
      const bounds = normalizeViewportBounds({
        minLat: mapBounds.getSouth(),
        minLon: mapBounds.getWest(),
        maxLat: mapBounds.getNorth(),
        maxLon: mapBounds.getEast(),
      });
      if (!bounds.valid) {
        onBackendStatusChange({
          state: "invalid-viewport",
          aircraftCount: aircraftRef.current.length,
          updatedAt: null,
          cacheStatus: null,
        });
        return true;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLIS);
      try {
        const result = await fetchLiveAircraft(
          bounds.bounds,
          controller.signal,
        );
        if (controller.signal.aborted || disposed) return true;
        if (result.ok) {
          onSnapshot(result.snapshot.aircraft, {
            state: "connected",
            aircraftCount: result.snapshot.aircraft.length,
            updatedAt: Date.now(),
            cacheStatus: result.cacheStatus,
          });
          return true;
        }
        onBackendStatusChange({
          state: result.category === "viewport" ? "invalid-viewport" : "reconnecting",
          aircraftCount: aircraftRef.current.length,
          updatedAt: null,
          cacheStatus: null,
        });
        return !result.retryable;
      } catch {
        if (controller.signal.aborted || disposed) return true;
        onBackendStatusChange({
          state: "reconnecting",
          aircraftCount: aircraftRef.current.length,
          updatedAt: null,
          cacheStatus: null,
        });
        return false;
      } finally {
        window.clearTimeout(timeout);
        if (requestRef.current === controller) requestRef.current = null;
      }
    };

    const handleMoveEnd = () => {
      if (followMoveRef.current) {
        followMoveRef.current = false;
        return;
      }
      if (moveDebounceRef.current !== null) {
        window.clearTimeout(moveDebounceRef.current);
      }
      moveDebounceRef.current = window.setTimeout(() => {
        requestRef.current?.abort();
        schedulerRef.current?.reset();
      }, MOVE_END_DEBOUNCE_MILLIS);
    };

    const handleDragStart = () => {
      if (!followEnabledRef.current) return;
      followEnabledRef.current = false;
      lastFollowSampleRef.current = null;
      onFollowStopped();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        requestRef.current?.abort();
        schedulerRef.current?.pause();
      } else {
        schedulerRef.current?.resume();
      }
    };

    const handleLoad = () => {
      if (disposed) return;
      styleReady = true;
      registrationRef.current = registerAircraftMapPresentation(
        map,
        aircraftFeaturesRef.current,
        onSelectAircraft,
      );
      historicalTrackRegistrationRef.current =
        registerHistoricalTrackMapPresentation(
          map,
          historicalTrackFeaturesRef.current,
        );
      registrationRef.current.setVisibleAircraftIds(
        visibleAircraftIdsRef.current,
      );
      motionRuntimeRef.current = new AircraftMotionRuntime({
        aircraft: aircraftRef.current,
        sourceWriter: registrationRef.current.sourceWriter,
        selectedAircraftId: selectedAircraftIdRef.current,
        favoriteAircraftIds: favoriteAircraftIdsRef.current,
        window,
        document,
        reducedMotionQuery: window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ),
        onFrame: (frameAircraft, frameTimeMillis) => {
          motionAircraftRef.current = frameAircraft;
          if (!followEnabledRef.current || !selectedAircraftIdRef.current) return;
          const target = frameAircraft.find(
            (item) => item.id === selectedAircraftIdRef.current,
          );
          if (!target) return;
          const sample = {
            longitudeDegrees: target.longitudeDegrees,
            latitudeDegrees: target.latitudeDegrees,
            timestampMillis: frameTimeMillis,
          };
          if (!shouldUpdateFollowCamera(lastFollowSampleRef.current, sample)) return;
          lastFollowSampleRef.current = sample;
          followMoveRef.current = true;
          map.easeTo({
            center: [sample.longitudeDegrees, sample.latitudeDegrees],
            duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 450,
            essential: false,
          });
        },
      });
      motionRuntimeRef.current.start();
      schedulerRef.current = new ViewportPollingScheduler(requestViewport);
      schedulerRef.current.start();
      onStatusChange("ready");
      onBearingChange(map.getBearing());
    };

    const handleError = (event: ErrorEvent) => {
      const message =
        event.error instanceof Error ? event.error.message : "Unknown map error";
      if (!styleReady && !disposed) onStatusChange("error");
      console.warn(`[SkyTracker map] ${message}`);
    };

    const handleRotate = () => {
      if (!disposed) onBearingChange(map.getBearing());
    };

    map.once("style.load", handleLoad);
    map.on("error", handleError);
    map.on("rotate", handleRotate);
    map.on("moveend", handleMoveEnd);
    map.on("dragstart", handleDragStart);
    document.addEventListener("visibilitychange", handleVisibility);

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== null) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        if (!disposed) map.resize();
      });
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      motionRuntimeRef.current?.dispose();
      motionRuntimeRef.current = null;
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
      requestRef.current?.abort();
      requestRef.current = null;
      if (moveDebounceRef.current !== null) {
        window.clearTimeout(moveDebounceRef.current);
        moveDebounceRef.current = null;
      }
      registrationRef.current?.remove();
      registrationRef.current = null;
      historicalTrackRegistrationRef.current?.remove();
      historicalTrackRegistrationRef.current = null;
      map.off("style.load", handleLoad);
      map.off("error", handleError);
      map.off("rotate", handleRotate);
      map.off("moveend", handleMoveEnd);
      map.off("dragstart", handleDragStart);
      document.removeEventListener("visibilitychange", handleVisibility);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [
    mapRef,
    onBearingChange,
    onBackendStatusChange,
    onSnapshot,
    onFollowStopped,
    onSelectAircraft,
    onStatusChange,
    style,
  ]);

  const animationDuration = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;

  const compassVisible = Math.abs(bearing) > 0.5;

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full bg-[#06101c]"
        role="region"
        aria-label="Map of Western Europe with local backend development aircraft. Use arrow keys to pan and plus or minus to zoom when the map has focus."
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(3,7,17,0.06),rgba(3,7,17,0.24))]"
      />

      {status === "loading" && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#030914]/84 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="h-16 w-16 rounded-full border border-cyan-200/12 bg-cyan-200/[0.035] shadow-[0_0_60px_rgba(34,211,238,0.12)] motion-safe:animate-pulse"
            />
            <p className="mt-5 text-sm font-medium text-white/72">Loading map</p>
            <p className="mt-1 text-xs text-white/34">
              Preparing local backend connection
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#030914]/88 px-5 backdrop-blur-md">
          <div
            className="w-full max-w-sm rounded-[24px] border border-red-300/14 bg-[#0a101c]/92 p-6 text-center shadow-2xl"
            role="alert"
          >
            <p className="text-sm font-semibold text-white/88">
              The map could not be loaded
            </p>
            <p className="mt-2 text-sm leading-6 text-white/46">
              Check your connection and try loading the map again.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="ol-interactive mt-5 min-h-11 rounded-full border border-cyan-200/18 bg-cyan-200/[0.07] px-5 text-sm font-medium text-cyan-50 hover:bg-cyan-200/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              Retry map
            </button>
          </div>
        </div>
      )}

      {status === "ready" && (
        <aside
          aria-live="polite"
          className="absolute left-3 top-3 z-10 max-w-[calc(100%-5.5rem)] rounded-[18px] border border-white/10 bg-[#06101b]/72 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:left-5 sm:top-5 lg:left-7"
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-cyan-300"
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
              {replayMode
                ? "Local session replay"
                : backendStatusTitle(backendStatus.state)}
            </p>
          </div>
          {replayMode ? (
            <p className="mt-2 text-sm font-medium text-white/82">
              Live recording continues in the background
            </p>
          ) : backendStatus.state !== "not-configured" && (
            <p className="mt-2 text-sm font-medium text-white/82">
              {backendStatus.aircraftCount} aircraft from local backend
            </p>
          )}
          <p className="mt-1 hidden text-xs leading-5 text-white/36 sm:block">
            {replayMode
              ? "Showing an in-memory session snapshot"
              : backendStatusDetail(backendStatus)}
          </p>
        </aside>
      )}

      <div
        className="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#06101b]/76 shadow-[0_16px_42px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:right-5 sm:top-5 lg:right-7"
        aria-label="Map controls"
      >
        <MapControlButton
          label="Zoom in"
          disabled={status !== "ready"}
          onClick={() =>
            mapRef.current?.zoomIn({ duration: animationDuration() })
          }
        >
          <path d="M12 5v14M5 12h14" />
        </MapControlButton>
        <MapControlButton
          label="Zoom out"
          disabled={status !== "ready"}
          onClick={() =>
            mapRef.current?.zoomOut({ duration: animationDuration() })
          }
        >
          <path d="M5 12h14" />
        </MapControlButton>
        {compassVisible && (
          <MapControlButton
            label="Reset bearing to North Up"
            onClick={() =>
              mapRef.current?.easeTo({
                bearing: 0,
                duration: animationDuration(),
              })
            }
          >
            <g
              style={{
                transform: `rotate(${-bearing}deg)`,
                transformOrigin: "12px 12px",
              }}
            >
              <path d="m12 4 4.5 15L12 16l-4.5 3L12 4Z" />
            </g>
          </MapControlButton>
        )}
      </div>
    </>
  );
}

type MapControlButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

type FavoriteSearchOptionProps = {
  result: FavoriteSearchResult;
  index: number;
  active: boolean;
  currentAircraft: readonly Aircraft[];
  onActivate: () => void;
  onHover: () => void;
};

function FavoriteSearchOption({
  result,
  index,
  active,
  currentAircraft,
  onActivate,
  onHover,
}: FavoriteSearchOptionProps) {
  const isAvailable =
    result.kind === "airport" ||
    currentAircraft.some((aircraft) => aircraft.id === result.favorite.aircraftId);
  const title =
    result.kind === "aircraft"
      ? result.favorite.callsign ||
        result.favorite.registration ||
        result.favorite.aircraftId.toUpperCase()
      : result.favorite.name;
  const detail =
    result.kind === "aircraft"
      ? [
          result.favorite.registration,
          isAvailable ? "Visible now" : "Not currently visible",
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          result.favorite.iataCode,
          result.favorite.icaoCode,
          result.favorite.city,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <button
      id={`skytracker-search-result-${index}`}
      type="button"
      role="option"
      aria-selected={active}
      aria-disabled={!isAvailable}
      onMouseEnter={onHover}
      onClick={isAvailable ? onActivate : undefined}
      className={`ol-interactive flex min-h-16 w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 ${
        active ? "bg-amber-200/[0.09]" : "hover:bg-white/[0.045]"
      } ${isAvailable ? "" : "cursor-not-allowed opacity-55"}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-white/88">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-white/42">
          {detail}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="shrink-0 text-base text-amber-200/80"
      >
        ★
      </span>
    </button>
  );
}

function favoriteAirportDetails(favorite: FavoriteAirport): AirportDetails {
  return {
    airport: {
      icaoCode: favorite.icaoCode,
      iataCode: favorite.iataCode,
      name: favorite.name,
      latitudeDegrees: favorite.latitudeDegrees,
      longitudeDegrees: favorite.longitudeDegrees,
      countryCode: favorite.countryCode,
    },
    city: favorite.city,
    elevationMeters: null,
    timezone: null,
    runways: [],
  };
}

function MapControlButton({
  label,
  disabled = false,
  onClick,
  children,
}: MapControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="ol-interactive flex h-12 w-12 items-center justify-center border-b border-white/[0.07] text-white/66 last:border-b-0 hover:bg-white/[0.07] hover:text-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 disabled:cursor-wait disabled:text-white/20"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

function updateAircraftQuery(aircraftId: AircraftId | null) {
  const url = new URL(window.location.href);
  if (aircraftId) url.searchParams.set("aircraft", aircraftId);
  else url.searchParams.delete("aircraft");
  window.history.replaceState(window.history.state, "", url);
}

function backendStatusTitle(state: BackendStatus["state"]) {
  switch (state) {
    case "not-configured":
      return "Backend not configured";
    case "connecting":
      return "Connecting to local backend";
    case "connected":
      return "Local backend connected";
    case "reconnecting":
      return "Backend temporarily unavailable";
    case "invalid-viewport":
      return "Zoom in to load aircraft";
  }
}

function backendStatusDetail(status: BackendStatus) {
  if (status.state === "reconnecting") return "Using last valid snapshot";
  if (status.state === "not-configured") return "Set the public local API base URL";
  if (status.state === "invalid-viewport") return "The current viewport exceeds backend limits";
  if (status.state === "connecting") return "Waiting for the first development snapshot";
  const cache = status.cacheStatus ? ` · cache ${status.cacheStatus}` : "";
  return `Backend development data${cache}`;
}

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
