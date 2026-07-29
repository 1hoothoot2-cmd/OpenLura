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
  aircraftLifecycleLabel,
  applyAircraftLifecycles,
} from "../../aircraft/domain/aircraftLifecycle";
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
import {
  planAdaptiveViewport,
  type AdaptiveViewportPlan,
  type AdaptiveViewportTile,
} from "../../backend/domain/adaptiveViewportTiles";
import {
  AIRCRAFT_BACKGROUND_REFRESH_MILLIS,
  AircraftTileCache,
} from "../../backend/domain/aircraftTileCache";
import { reconcileSnapshot } from "../../backend/domain/snapshotReconciliation";
import { SnapshotAcceptancePolicy } from "../../backend/domain/snapshotAcceptance";
import {
  fetchLiveAircraft,
  isDelayedAircraftCache,
} from "../../backend/infrastructure/liveAircraftClient";
import { searchGlobalAircraft } from "../../backend/infrastructure/globalAircraftSearchClient";
import {
  MOVE_END_DEBOUNCE_MILLIS,
  REQUEST_TIMEOUT_MILLIS,
} from "../../backend/infrastructure/viewportPollingScheduler";
import { AdaptiveTileScheduler } from "../../backend/infrastructure/adaptiveTileScheduler";
import {
  registerAircraftMapPresentation,
  type AircraftMapRegistration,
} from "../presentation/aircraftMapRenderer";
import { presentWorldExperienceStatus } from "../presentation/worldExperienceStatus";
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
import type { FlightLegInformation } from "../../historical-track/domain/flightLegInformation";
import {
  createObservedSessionTrack,
  extendTrackToLatestObservation,
} from "../../historical-track/domain/observedFlightHistory";
import { fetchHistoricalTrackForAircraft } from "../../historical-track/infrastructure/historicalTrackClient";
import {
  createHistoricalTrackFeatureCollection,
  type HistoricalTrackFeatureCollection,
} from "../../historical-track/presentation/historicalTrackGeoJson";
import {
  registerHistoricalTrackMapPresentation,
  type HistoricalTrackMapRegistration,
} from "../../historical-track/presentation/historicalTrackMapRenderer";
import type { SkyGuideMapContext } from "../../skyguide/domain/skyGuide";
import { SkyGuidePanel } from "../../skyguide/presentation/SkyGuidePanel";
import { SkyTrackerAccountControl } from "../../personal-platform/presentation/SkyTrackerAccountControl";

type MapStatus = "loading" | "ready" | "error";

const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";

type BackendStatus = Readonly<{
  state:
    | "not-configured"
    | "connecting"
    | "loading-region"
    | "connected"
    | "reconnecting"
    | "invalid-viewport";
  aircraftCount: number;
  updatedAt: number | null;
  cacheStatus: string | null;
  loadedRegionCount?: number;
  plannedRegionCount?: number;
  totalVisibleRegionCount?: number;
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
type MobilePanelTab = "details" | "skyguide";

type HistoricalTrackState =
  | Readonly<{ status: "idle" | "loading" | "unavailable" }>
  | Readonly<{
      status: "ready";
      track: HistoricalTrack | null;
      flight: FlightLegInformation;
    }>;

type GlobalSearchState =
  | Readonly<{ status: "idle" | "loading" | "unavailable" }>
  | Readonly<{ status: "ready"; aircraft: readonly Aircraft[] }>;

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
  const [mobilePanelTab, setMobilePanelTab] =
    useState<MobilePanelTab>("skyguide");
  const [skyGuideMapContext, setSkyGuideMapContext] =
    useState<SkyGuideMapContext | null>(null);
  const [filters, setFilters] = useState(DEFAULT_AIRCRAFT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchState, setGlobalSearchState] =
    useState<GlobalSearchState>({ status: "idle" });
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
  const [lifecycleEpochMillis, setLifecycleEpochMillis] = useState(() =>
    Date.now(),
  );
  const [replayState, setReplayState] =
    useState<ReplayState>(LIVE_REPLAY_STATE);
  const [historicalTrackState, setHistoricalTrackState] =
    useState<HistoricalTrackState>({ status: "idle" });
  const mapRef = useRef<MapLibreMap | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchRequestIdRef = useRef(0);
  const globalSearchAbortRef = useRef<AbortController | null>(null);
  const favoritesRepositoryRef = useRef<FavoritesRepository | null>(null);
  const currentAircraftRef = useRef<readonly Aircraft[]>([]);
  const latestLiveAircraftRef = useRef<readonly Aircraft[]>([]);
  const livePhaseSessionsRef = useRef<FlightPhaseSessions>(new Map());
  const replayFramesRef = useRef<readonly RecordedSessionFrame[]>([]);
  const replayModeRef = useRef<ReplayState["mode"]>("live");
  const initialSelectionAttemptedRef = useRef(false);
  const selectedAircraftIdRef = useRef<AircraftId | null>(null);

  useEffect(() => {
    selectedAircraftIdRef.current = selectedAircraftId;
  }, [selectedAircraftId]);

  useEffect(() => {
    replayModeRef.current = replayState.mode;
  }, [replayState.mode]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setLifecycleEpochMillis(Date.now()),
      15_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const mergeAccountFavorites = useCallback(
    (merged: SkyTrackerFavorites) => {
      const repository = favoritesRepositoryRef.current;
      const saved = repository ? repository.save(merged) : merged;
      setFavorites(saved);
      setFavoriteAnnouncement("Account favorites synchronized");
    },
    [],
  );

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
  const displayAircraft = useMemo(
    () =>
      replayState.mode === "replay"
        ? aircraft
        : applyAircraftLifecycles(aircraft, lifecycleEpochMillis),
    [aircraft, lifecycleEpochMillis, replayState.mode],
  );
  useEffect(() => {
    currentAircraftRef.current = displayAircraft;
  }, [displayAircraft]);
  const presentedAircraft = useMemo(
    () =>
      presentAircraft(
        displayAircraft,
        selectedAircraftId,
        favoriteAircraftIds,
      ),
    [displayAircraft, favoriteAircraftIds, selectedAircraftId],
  );
  const aircraftFeatures = useMemo(
    () => createAircraftFeatureCollection(presentedAircraft),
    [presentedAircraft],
  );
  const searchResults = useMemo(
    () => searchAircraft(displayAircraft, searchQuery),
    [displayAircraft, searchQuery],
  );
  const globalSearchResults = useMemo(
    () =>
      globalSearchState.status === "ready"
        ? searchAircraft(
            applyAircraftLifecycles(
              globalSearchState.aircraft,
              lifecycleEpochMillis,
            ),
            searchQuery,
          )
        : [],
    [globalSearchState, lifecycleEpochMillis, searchQuery],
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
    () => filterAircraft(displayAircraft, filters),
    [displayAircraft, filters],
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
  const selectedAircraft =
    displayAircraft.find((item) => item.id === selectedAircraftId) ?? null;
  const selectedPresentedAircraft =
    presentedAircraft.find((item) => item.selected) ?? null;
  const selectedFlightPhaseSession = selectedAircraftId
    ? flightPhaseSessions.get(selectedAircraftId) ?? null
    : null;
  const recordingFrameCount = recorder.frameCount;
  const observedSessionTrack = useMemo(
    () =>
      recordingFrameCount < 2
        ? null
        : createObservedSessionTrack(recorder.snapshot(), selectedAircraftId),
    [recorder, recordingFrameCount, selectedAircraftId],
  );
  const activeHistoricalTrack = useMemo(() => {
    const backendTrack =
      historicalTrackState.status === "ready"
        ? historicalTrackState.track
        : null;
    const track = backendTrack ?? observedSessionTrack;
    return track && selectedAircraft
      ? extendTrackToLatestObservation(track, selectedAircraft)
      : track;
  }, [historicalTrackState, observedSessionTrack, selectedAircraft]);
  const historicalTrackFeatures = useMemo(
    () => createHistoricalTrackFeatureCollection(activeHistoricalTrack),
    [activeHistoricalTrack],
  );
  const skyGuideContext = useMemo(
    () => ({
      selectedAircraft: selectedAircraft
        ? {
            id: selectedAircraft.id,
            callsign: selectedAircraft.callsign,
            registration: selectedAircraft.registration,
            lifecycle: aircraftLifecycleLabel(selectedAircraft.lifecycle),
            latitudeDegrees: selectedAircraft.latitudeDegrees,
            longitudeDegrees: selectedAircraft.longitudeDegrees,
            altitudeMeters: selectedAircraft.altitudeMeters,
            groundSpeedMetersPerSecond:
              selectedAircraft.groundSpeedMetersPerSecond,
            headingDegrees: selectedAircraft.headingDegrees,
          }
        : null,
      map: skyGuideMapContext,
      flightHistory:
        historicalTrackState.status === "loading"
          ? ("loading" as const)
          : activeHistoricalTrack
            ? activeHistoricalTrack.provider === "session"
              ? ("session-only" as const)
              : ("available" as const)
            : ("unavailable" as const),
      favorites: {
        aircraftIds: favorites.aircraft.map((item) => item.aircraftId),
        airportCodes: favorites.airports.map((item) => item.icaoCode),
      },
    }),
    [
      activeHistoricalTrack,
      historicalTrackState.status,
      selectedAircraft,
      skyGuideMapContext,
      favorites.aircraft,
      favorites.airports,
    ],
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
            ? {
                status: "ready",
                track: result.track,
                flight: result.flight,
              }
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
    if (validSelection) {
      setSelectedAirport(null);
      setMobilePanelTab("details");
    }
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
    globalSearchAbortRef.current?.abort();
    globalSearchAbortRef.current = null;
    setSearchOpen(false);
    setSearchQuery("");
    setGlobalSearchState({ status: "idle" });
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

  const runGlobalAircraftSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!/^[a-z0-9-]{2,16}$/i.test(query)) return;
    globalSearchAbortRef.current?.abort();
    const controller = new AbortController();
    globalSearchAbortRef.current = controller;
    setGlobalSearchState({ status: "loading" });
    const result = await searchGlobalAircraft(query, controller.signal).catch(
      () => ({ ok: false, category: "unavailable" } as const),
    );
    if (controller.signal.aborted || globalSearchAbortRef.current !== controller) {
      return;
    }
    globalSearchAbortRef.current = null;
    setGlobalSearchState(
      result.ok
        ? { status: "ready", aircraft: result.aircraft }
        : { status: "unavailable" },
    );
  }, [searchQuery]);

  const selectGlobalSearchResult = useCallback(
    (result: AircraftSearchResult) => {
      const merged = mergeAircraftByNewestPosition(
        currentAircraftRef.current,
        [result.aircraft],
      );
      currentAircraftRef.current = merged;
      setAircraft(merged);
      setSelectedAirport(null);
      setFollowEnabled(false);
      setSelectedAircraftId(result.aircraft.id);
      updateAircraftQuery(result.aircraft.id);
      searchRequestIdRef.current += 1;
      setMapFocusRequest({
        longitudeDegrees: result.aircraft.longitudeDegrees,
        latitudeDegrees: result.aircraft.latitudeDegrees,
        requestId: searchRequestIdRef.current,
      });
      closeSearch();
    },
    [closeSearch],
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

  useEffect(
    () => () => {
      globalSearchAbortRef.current?.abort();
    },
    [],
  );

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
              : IS_PRODUCTION_BUILD
                ? "Live backend data"
                : "Backend development data"}
          </span>
          <SkyTrackerAccountControl
            localFavorites={favorites}
            onFavoritesMerged={mergeAccountFavorites}
          />
          <Link
            href="/skytracker"
            className="ol-interactive hidden min-h-11 items-center rounded-full border border-white/10 px-4 text-sm text-white/58 hover:border-white/18 hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:inline-flex"
          >
            Product page
          </Link>
        </div>
      </header>

      <section
        aria-label={`Interactive SkyTracker map using ${
          IS_PRODUCTION_BUILD ? "live backend data" : "local backend development data"
        }. Select an aircraft on the map, or use the clear selection button after selecting one.`}
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
          aircraft={displayAircraft}
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
          onViewportContextChange={setSkyGuideMapContext}
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
                    globalSearchAbortRef.current?.abort();
                    globalSearchAbortRef.current = null;
                    setGlobalSearchState({ status: "idle" });
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
                  globalSearchAbortRef.current?.abort();
                  globalSearchAbortRef.current = null;
                  setGlobalSearchState({ status: "idle" });
                  setActiveSearchIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeSearch();
                    return;
                  }
                  if (!searchQuery.trim()) return;
                  if (
                    event.key === "Enter" &&
                    searchTab === "aircraft" &&
                    activeSearchResultsLength === 0
                  ) {
                    event.preventDefault();
                    void runGlobalAircraftSearch();
                    return;
                  }
                  if (activeSearchResultsLength === 0) return;
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
                  searchTab === "aircraft" ? (
                    <div className="px-2 py-4">
                      <p role="status" className="text-sm text-white/46">
                        No matching aircraft in the loaded map regions
                      </p>
                      <button
                        type="button"
                        disabled={
                          globalSearchState.status === "loading" ||
                          !/^[a-z0-9-]{2,16}$/i.test(searchQuery.trim())
                        }
                        onClick={() => void runGlobalAircraftSearch()}
                        className="ol-interactive mt-3 min-h-11 rounded-full border border-cyan-200/18 bg-cyan-200/[0.07] px-4 text-sm font-medium text-cyan-50 hover:bg-cyan-200/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {globalSearchState.status === "loading"
                          ? "Searching worldwide…"
                          : "Search worldwide"}
                      </button>
                      {globalSearchState.status === "unavailable" && (
                        <p role="status" className="mt-3 text-xs leading-5 text-amber-100/64">
                          Worldwide search is temporarily unavailable. Loaded map
                          regions remain searchable.
                        </p>
                      )}
                      {globalSearchState.status === "ready" &&
                        globalSearchResults.length === 0 && (
                          <p role="status" className="mt-3 text-xs leading-5 text-white/42">
                            No current worldwide match. The aircraft may be unknown,
                            stale or no longer visible.
                          </p>
                        )}
                      {globalSearchResults.map((result) => (
                        <button
                          key={`global-${result.aircraft.id}`}
                          type="button"
                          onClick={() => selectGlobalSearchResult(result)}
                          className="ol-interactive mt-2 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.055] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-white/88">
                              {result.aircraft.callsign?.trim() ||
                                result.aircraft.id.toUpperCase()}
                            </span>
                            <span className="mt-0.5 block text-xs text-cyan-100/48">
                              Worldwide ·{" "}
                              {aircraftLifecycleLabel(result.aircraft.lifecycle)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-cyan-100/46">
                            {result.aircraft.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p role="status" className="px-2 py-4 text-sm text-white/46">
                      {searchTab === "favorites"
                        ? "No favorites saved yet"
                        : "No matching airports found"}
                    </p>
                  )
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
                          {result.aircraft.registration?.trim() ||
                            "Registration unknown"}{" "}
                          · {aircraftLifecycleLabel(result.aircraft.lifecycle)}
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
                {searchTab === "aircraft" &&
                  activeSearchResultsLength > 0 &&
                  globalSearchState.status === "idle" && (
                    <button
                      type="button"
                      onClick={() => void runGlobalAircraftSearch()}
                      className="ol-interactive mt-2 min-h-11 w-full rounded-xl border border-white/[0.08] px-3 text-sm text-cyan-100/62 hover:bg-cyan-200/[0.06] hover:text-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      Search worldwide instead
                    </button>
                  )}
                {searchTab === "aircraft" &&
                  activeSearchResultsLength > 0 &&
                  globalSearchState.status === "loading" && (
                    <p role="status" className="px-3 py-3 text-xs text-cyan-100/54">
                      Searching worldwide…
                    </p>
                  )}
                {searchTab === "aircraft" &&
                  activeSearchResultsLength > 0 &&
                  globalSearchResults.map((result) => (
                    <button
                      key={`global-${result.aircraft.id}`}
                      type="button"
                      onClick={() => selectGlobalSearchResult(result)}
                      className="ol-interactive mt-2 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-cyan-200/10 bg-cyan-200/[0.055] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white/88">
                          {result.aircraft.callsign?.trim() ||
                            result.aircraft.id.toUpperCase()}
                        </span>
                        <span className="mt-0.5 block text-xs text-cyan-100/48">
                          Worldwide ·{" "}
                          {aircraftLifecycleLabel(result.aircraft.lifecycle)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-cyan-100/46">
                        {result.aircraft.id}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </aside>
        )}

        {filtersOpen && (
          <AircraftFilterPanel
            filters={filters}
            visibleCount={visibleAircraft.length}
            totalCount={displayAircraft.length}
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
            <MobilePanelTabs
              activeTab={mobilePanelTab}
              detailsAvailable
              onSelect={setMobilePanelTab}
            />
            <div className={mobilePanelTab === "details" ? "" : "hidden sm:block"}>
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
              {aircraftDetailItems(
                selectedAircraft,
                historicalTrackState.status === "ready"
                  ? historicalTrackState.flight
                  : null,
              ).map((item) => (
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
              aria-label="Flight history status"
              className="mt-4 border-t border-white/[0.07] pt-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100/48">
                Flight history
              </p>
              {historicalTrackState.status === "loading" ? (
                <p className="mt-1.5 text-sm text-cyan-100/68">
                  Loading flight history…
                </p>
              ) : activeHistoricalTrack ? (
                <p className="mt-1.5 text-sm text-white/68">
                  {activeHistoricalTrack.provider === "session"
                    ? "Observed this session"
                    : activeHistoricalTrack.completeness === "COMPLETE"
                      ? "Complete flight path"
                      : "Observed flight path"}{" "}
                  · {activeHistoricalTrack.points.length} points ·{" "}
                  {activeHistoricalTrack.segments.length}{" "}
                  {activeHistoricalTrack.segments.length === 1
                    ? "segment"
                    : "segments"}
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-white/48">
                  No reliable flight history available yet.
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
                disabled
                aria-label="Monitor aircraft (coming soon)"
                title="Intelligent Monitoring is coming soon"
                className="min-h-11 cursor-not-allowed rounded-full border border-white/8 bg-white/[0.025] px-4 text-sm font-medium text-white/38"
              >
                Monitor
              </button>
              <button
                type="button"
                onClick={() => selectAircraft(null)}
                className="ol-interactive min-h-11 rounded-full border border-white/10 px-4 text-sm text-white/68 hover:border-white/18 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Clear selection
              </button>
            </div>
            </div>
            <div className={mobilePanelTab === "skyguide" ? "sm:hidden" : "hidden"}>
              <SkyGuidePanel context={skyGuideContext} />
            </div>
          </aside>
        )}
        {!selectedAirport && !selectedAircraft && (
          <aside
            aria-label="SkyTracker mobile information"
            className="absolute bottom-3 left-3 right-3 z-20 max-h-[min(62vh,34rem)] overflow-y-auto rounded-[22px] border border-cyan-200/14 bg-[#07101b]/92 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:hidden"
          >
            <MobilePanelTabs
              activeTab={mobilePanelTab}
              detailsAvailable={false}
              onSelect={setMobilePanelTab}
            />
            {mobilePanelTab === "details" ? (
              <p role="status" className="py-8 text-center text-sm text-white/46">
                Select an aircraft to view its details.
              </p>
            ) : (
              <SkyGuidePanel context={skyGuideContext} />
            )}
          </aside>
        )}
        <aside
          aria-label="SkyGuide aviation assistant"
          className="absolute bottom-5 right-5 z-20 hidden max-h-[min(70vh,38rem)] w-[21rem] overflow-y-auto rounded-[22px] border border-cyan-200/14 bg-[#07101b]/90 p-4 shadow-[0_18px_55px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:block lg:right-7"
        >
          <SkyGuidePanel context={skyGuideContext} />
        </aside>
        <p className="sr-only" aria-live="polite">
          {favoriteAnnouncement}
        </p>
      </section>
    </main>
  );
}

function MobilePanelTabs({
  activeTab,
  detailsAvailable,
  onSelect,
}: {
  activeTab: MobilePanelTab;
  detailsAvailable: boolean;
  onSelect: (tab: MobilePanelTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="SkyTracker information"
      className="mb-4 grid grid-cols-2 rounded-xl border border-white/[0.08] bg-black/20 p-1 sm:hidden"
    >
      {(["details", "skyguide"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          aria-disabled={tab === "details" && !detailsAvailable}
          onClick={() => onSelect(tab)}
          className={`ol-interactive min-h-10 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
            activeTab === tab
              ? "bg-cyan-200/[0.1] text-cyan-50"
              : "text-white/46 hover:bg-white/[0.04] hover:text-white/76"
          }`}
        >
          {tab === "details" ? "Details" : "SkyGuide"}
        </button>
      ))}
    </div>
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
  onViewportContextChange: (context: SkyGuideMapContext) => void;
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
  onViewportContextChange,
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
  const schedulerRef = useRef<AdaptiveTileScheduler<AdaptiveViewportTile> | null>(
    null,
  );
  const snapshotAcceptanceRef = useRef(
    new Map<string, SnapshotAcceptancePolicy>(),
  );
  const tileCacheRef = useRef(new AircraftTileCache());
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
    motionRuntimeRef.current?.setAircraftSnapshot(aircraft, replayMode);
  }, [aircraft, replayMode]);

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
    let desiredPlan: AdaptiveViewportPlan | null = null;

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
    map.setMissingStyleImageResolver((imageId) => {
      if (!/^circle-\d+$/.test(imageId) || map.hasImage(imageId)) return;
      map.addImage(imageId, {
        width: 1,
        height: 1,
        data: new Uint8Array([0, 0, 0, 0]),
      });
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");

    const publishPlan = (
      plan: AdaptiveViewportPlan,
      state: BackendStatus["state"],
      cacheStatus: string | null,
    ) => {
      const keys = plan.tiles.map((tile) => tile.key);
      const now = Date.now();
      const loadedRegionCount = tileCacheRef.current.loadedCount(keys, now);
      const loadedAircraft = tileCacheRef.current.merge(keys, now);
      const delayed = tileCacheRef.current.hasDelayedData(keys, now);
      const mergedAircraft =
        loadedRegionCount < plan.tiles.length
          ? mergeAircraftByNewestPosition(aircraftRef.current, loadedAircraft)
          : loadedAircraft;
      const nextStatus: BackendStatus = {
        state: delayed ? "reconnecting" : state,
        aircraftCount: mergedAircraft.length,
        updatedAt: now,
        cacheStatus,
        loadedRegionCount,
        plannedRegionCount: plan.tiles.length,
        totalVisibleRegionCount: plan.totalTileCount,
      };
      if (loadedRegionCount > 0 || state === "connected") {
        onSnapshot(mergedAircraft, nextStatus);
      } else {
        onBackendStatusChange({
          ...nextStatus,
          aircraftCount: aircraftRef.current.length,
          updatedAt: null,
        });
      }
    };

    const planCurrentViewport = () => {
      const bounds = map.getBounds();
      return planAdaptiveViewport({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    };

    const publishViewportContext = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      onViewportContextChange({
        centerLatitudeDegrees: center.lat,
        centerLongitudeDegrees: center.lng,
        southLatitudeDegrees: bounds.getSouth(),
        westLongitudeDegrees: bounds.getWest(),
        northLatitudeDegrees: bounds.getNorth(),
        eastLongitudeDegrees: bounds.getEast(),
      });
    };

    const applyPlan = (plan: AdaptiveViewportPlan) => {
      if (plan.tiles.length === 0) {
        onBackendStatusChange({
          state: "invalid-viewport",
          aircraftCount: aircraftRef.current.length,
          updatedAt: null,
          cacheStatus: null,
        });
        return;
      }
      desiredPlan = plan;
      const loaded = tileCacheRef.current.loadedCount(
        plan.tiles.map((tile) => tile.key),
        Date.now(),
      );
      publishPlan(
        plan,
        loaded === plan.tiles.length ? "connected" : "loading-region",
        loaded > 0 ? "memory" : null,
      );
      schedulerRef.current?.setTiles(plan.tiles);
    };

    const requestTile = async (tile: AdaptiveViewportTile) => {
      if (disposed || document.hidden) return "skipped" as const;
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MILLIS);
      try {
        const result = await fetchLiveAircraft(
          tile.bounds,
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          disposed ||
          !desiredPlan?.tiles.some((candidate) => candidate.key === tile.key)
        ) {
          return "skipped" as const;
        }
        if (result.ok) {
          let policy = snapshotAcceptanceRef.current.get(tile.key);
          if (!policy) {
            policy = new SnapshotAcceptancePolicy();
            snapshotAcceptanceRef.current.set(tile.key, policy);
          }
          const decision = policy.evaluate(result.snapshot);
          if (!decision.accepted) {
            if (process.env.NODE_ENV === "development") {
              console.debug("[SkyTracker polling] snapshot rejected", {
                reason: decision.reason,
                requestId: result.requestId,
                generatedAt: result.snapshot.generatedAtEpochMillis,
                aircraftCount: result.snapshot.aircraft.length,
              });
            }
            return true;
          }
          if (process.env.NODE_ENV === "development") {
            console.debug("[SkyTracker polling] snapshot accepted", {
              reason: decision.reason,
              requestId: result.requestId,
              generatedAt: result.snapshot.generatedAtEpochMillis,
              aircraftCount: result.snapshot.aircraft.length,
            });
          }
          tileCacheRef.current.put(
            tile.key,
            result.snapshot.aircraft,
            Date.now(),
            result.cacheStatus,
          );
          const plan = desiredPlan;
          if (plan) {
            const loaded = tileCacheRef.current.loadedCount(
              plan.tiles.map((candidate) => candidate.key),
              Date.now(),
            );
            publishPlan(
              plan,
              isDelayedAircraftCache(result.cacheStatus)
                ? "reconnecting"
                : loaded === plan.tiles.length
                  ? "connected"
                  : "loading-region",
              result.cacheStatus,
            );
          }
          return true;
        }
        onBackendStatusChange({
          state: result.category === "viewport" ? "invalid-viewport" : "reconnecting",
          aircraftCount: aircraftRef.current.length,
          updatedAt: null,
          cacheStatus: null,
        });
        return result.category === "viewport"
          ? "skipped" as const
          : !result.retryable;
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
      publishViewportContext();
      if (followMoveRef.current) {
        followMoveRef.current = false;
        return;
      }
      if (moveDebounceRef.current !== null) {
        window.clearTimeout(moveDebounceRef.current);
      }
      moveDebounceRef.current = window.setTimeout(() => {
        const plan = planCurrentViewport();
        if (plan.signature === desiredPlan?.signature) return;
        requestRef.current?.abort();
        applyPlan(plan);
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
      schedulerRef.current = new AdaptiveTileScheduler(
        requestTile,
        (tile, now) =>
          tileCacheRef.current.hasFresh(
            tile.key,
            now,
            tile.priority === "focus"
              ? undefined
              : AIRCRAFT_BACKGROUND_REFRESH_MILLIS,
          ),
      );
      applyPlan(planCurrentViewport());
      publishViewportContext();
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
      map.setMissingStyleImageResolver(null);
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
    onViewportContextChange,
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
        aria-label={`Worldwide map with ${
          IS_PRODUCTION_BUILD ? "live backend aircraft" : "local backend development aircraft"
        }. Use arrow keys to pan and plus or minus to zoom when the map has focus.`}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(3,7,17,0.06),rgba(3,7,17,0.24))]"
      />

      {status === "loading" && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#030914]/58 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#06101b]/82 px-4 py-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.7)] motion-safe:animate-pulse"
            />
            <p className="text-xs font-medium tracking-wide text-white/72">
              Loading live map
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
          aria-label="Live map status"
          className="absolute left-3 top-3 z-10 max-w-[calc(100%-5.5rem)] rounded-full border border-white/[0.09] bg-[#06101b]/76 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:left-5 sm:top-5 lg:left-7"
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusToneClass(
                presentWorldExperienceStatus(
                  backendStatus.state,
                  backendStatus.aircraftCount,
                  replayMode,
                ).tone,
              )}`}
            />
            <p className="truncate text-[11px] font-semibold tracking-[0.08em] text-white/68">
              {
                presentWorldExperienceStatus(
                  backendStatus.state,
                  backendStatus.aircraftCount,
                  replayMode,
                ).label
              }
            </p>
          </div>
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

function statusToneClass(tone: "live" | "loading" | "delayed" | "inactive") {
  switch (tone) {
    case "live":
      return "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]";
    case "loading":
      return "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.65)] motion-safe:animate-pulse";
    case "delayed":
      return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]";
    case "inactive":
      return "bg-white/40";
  }
}

function mergeAircraftByNewestPosition(
  current: readonly Aircraft[],
  incoming: readonly Aircraft[],
) {
  const merged = new Map<string, Aircraft>();
  for (const aircraft of [...current, ...incoming]) {
    const existing = merged.get(aircraft.id);
    if (
      !existing ||
      aircraft.positionTimestampEpochMillis >
        existing.positionTimestampEpochMillis
    ) {
      merged.set(aircraft.id, aircraft);
    }
  }
  return [...merged.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
