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
import { aircraftDetailItems } from "../../aircraft/presentation/aircraftDetails";
import { createAircraftFeatureCollection } from "../../aircraft/presentation/aircraftGeoJson";
import { presentAircraft } from "../../aircraft/presentation/presentedAircraft";
import { normalizeViewportBounds } from "../../backend/domain/viewportBounds";
import { reconcileSnapshot } from "../../backend/domain/snapshotReconciliation";
import { fetchLiveAircraft } from "../../backend/infrastructure/liveAircraftClient";
import { resolveSkyTrackerApiConfig } from "../../backend/infrastructure/skyTrackerApiConfig";
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
import {
  shouldUpdateFollowCamera,
  type FollowCameraSample,
} from "../domain/followCameraPolicy";

type MapStatus = "loading" | "ready" | "error";

const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const API_CONFIG = resolveSkyTrackerApiConfig();

type BackendStatus = Readonly<{
  state: "not-configured" | "connecting" | "connected" | "reconnecting" | "invalid-viewport";
  aircraftCount: number;
  updatedAt: number | null;
  cacheStatus: string | null;
}>;

type SkyTrackerLiveMapProps = {
  initialAircraftId?: string | null;
};

export function SkyTrackerLiveMap({
  initialAircraftId = null,
}: SkyTrackerLiveMapProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [bearing, setBearing] = useState(0);
  const [aircraft, setAircraft] = useState<readonly Aircraft[]>([]);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    state: API_CONFIG.configured ? "connecting" : "not-configured",
    aircraftCount: 0,
    updatedAt: null,
    cacheStatus: null,
  });
  const [selectedAircraftId, setSelectedAircraftId] =
    useState<AircraftId | null>(null);
  const [followEnabled, setFollowEnabled] = useState(false);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentAircraftRef = useRef<readonly Aircraft[]>([]);
  const initialSelectionAttemptedRef = useRef(false);
  const selectedAircraftIdRef = useRef<AircraftId | null>(null);

  useEffect(() => {
    currentAircraftRef.current = aircraft;
  }, [aircraft]);

  useEffect(() => {
    selectedAircraftIdRef.current = selectedAircraftId;
  }, [selectedAircraftId]);

  const presentedAircraft = useMemo(
    () =>
      presentAircraft(
        aircraft,
        selectedAircraftId,
      ),
    [aircraft, selectedAircraftId],
  );
  const aircraftFeatures = useMemo(
    () => createAircraftFeatureCollection(presentedAircraft),
    [presentedAircraft],
  );
  const selectedAircraft = aircraft.find((item) => item.id === selectedAircraftId) ?? null;
  const selectedPresentedAircraft =
    presentedAircraft.find((item) => item.selected) ?? null;

  const selectAircraft = useCallback((aircraftId: AircraftId | null) => {
    const validSelection =
      aircraftId &&
      currentAircraftRef.current.some((item) => item.id === aircraftId)
        ? aircraftId
        : null;
    if (validSelection !== selectedAircraftIdRef.current) setFollowEnabled(false);
    setSelectedAircraftId(validSelection);
    updateAircraftQuery(validSelection);
  }, []);

  const acceptSnapshot = useCallback((nextAircraft: readonly Aircraft[], nextStatus: BackendStatus) => {
    setAircraft([...nextAircraft]);
    setBackendStatus(nextStatus);
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
  }, [initialAircraftId]);

  const stopFollowing = useCallback(() => setFollowEnabled(false), []);

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
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-cyan-200/12 bg-cyan-200/[0.045] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/62">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.55)]"
            />
            Backend development data
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
          aircraft={aircraft}
          selectedAircraftId={selectedAircraftId}
          followEnabled={followEnabled}
          backendStatus={backendStatus}
          onBackendStatusChange={setBackendStatus}
          onSnapshot={acceptSnapshot}
          onStatusChange={setStatus}
          onBearingChange={setBearing}
          onSelectAircraft={selectAircraft}
          onFollowStopped={stopFollowing}
          onRetry={retryMap}
        />

        {selectedAircraft && selectedPresentedAircraft && (
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
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
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
  aircraft: readonly Aircraft[];
  selectedAircraftId: AircraftId | null;
  followEnabled: boolean;
  backendStatus: BackendStatus;
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
  aircraft,
  selectedAircraftId,
  followEnabled,
  backendStatus,
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
  const motionRuntimeRef = useRef<AircraftMotionRuntime | null>(null);
  const aircraftFeaturesRef = useRef(aircraftFeatures);
  const selectedAircraftIdRef = useRef(selectedAircraftId);
  const aircraftRef = useRef(aircraft);
  const schedulerRef = useRef<ViewportPollingScheduler | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const moveDebounceRef = useRef<number | null>(null);
  const followEnabledRef = useRef(followEnabled);
  const lastFollowSampleRef = useRef<FollowCameraSample | null>(null);
  const followMoveRef = useRef(false);

  useEffect(() => {
    aircraftFeaturesRef.current = aircraftFeatures;
    selectedAircraftIdRef.current = selectedAircraftId;
    motionRuntimeRef.current?.setSelectedAircraftId(selectedAircraftId);
  }, [aircraftFeatures, selectedAircraftId]);

  useEffect(() => {
    followEnabledRef.current = followEnabled;
    if (!followEnabled) lastFollowSampleRef.current = null;
  }, [followEnabled]);

  useEffect(() => {
    aircraftRef.current = aircraft;
    motionRuntimeRef.current?.setAircraftSnapshot(aircraft);
  }, [aircraft]);

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
      if (!API_CONFIG.configured || disposed || document.hidden) return false;
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
          API_CONFIG.baseUrl,
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
      motionRuntimeRef.current = new AircraftMotionRuntime({
        aircraft: aircraftRef.current,
        sourceWriter: registrationRef.current.sourceWriter,
        selectedAircraftId: selectedAircraftIdRef.current,
        window,
        document,
        reducedMotionQuery: window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ),
        onFrame: (frameAircraft, frameTimeMillis) => {
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
      if (API_CONFIG.configured) {
        schedulerRef.current = new ViewportPollingScheduler(requestViewport);
        schedulerRef.current.start();
      }
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
              {backendStatusTitle(backendStatus.state)}
            </p>
          </div>
          {backendStatus.state !== "not-configured" && (
            <p className="mt-2 text-sm font-medium text-white/82">
              {backendStatus.aircraftCount} aircraft from local backend
            </p>
          )}
          <p className="mt-1 hidden text-xs leading-5 text-white/36 sm:block">
            {backendStatusDetail(backendStatus)}
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
