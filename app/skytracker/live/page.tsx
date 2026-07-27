import { SkyTrackerLiveMap } from "@/features/skytracker/map/components/SkyTrackerLiveMap";

export default async function SkyTrackerLivePage({
  searchParams,
}: {
  searchParams: Promise<{ aircraft?: string | string[] }>;
}) {
  const aircraft = (await searchParams).aircraft;
  return (
    <SkyTrackerLiveMap
      initialAircraftId={typeof aircraft === "string" ? aircraft : null}
    />
  );
}
