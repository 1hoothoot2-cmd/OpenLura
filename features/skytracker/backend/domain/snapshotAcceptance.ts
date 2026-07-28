import type { LiveAircraftSnapshot } from "./liveAircraftSnapshot.ts";

export type SnapshotAcceptanceDecision =
  | Readonly<{ accepted: true; reason: "initial" | "newer" | "changed" }>
  | Readonly<{ accepted: false; reason: "duplicate" | "older" }>;

export class SnapshotAcceptancePolicy {
  private latestGeneratedAt: number | null = null;
  private latestFingerprint: string | null = null;

  evaluate(snapshot: LiveAircraftSnapshot): SnapshotAcceptanceDecision {
    const fingerprint = aircraftFingerprint(snapshot);
    if (this.latestGeneratedAt === null) {
      this.commit(snapshot.generatedAtEpochMillis, fingerprint);
      return { accepted: true, reason: "initial" };
    }
    if (snapshot.generatedAtEpochMillis < this.latestGeneratedAt) {
      return { accepted: false, reason: "older" };
    }
    if (fingerprint === this.latestFingerprint) {
      this.latestGeneratedAt = Math.max(
        this.latestGeneratedAt,
        snapshot.generatedAtEpochMillis,
      );
      return { accepted: false, reason: "duplicate" };
    }

    const reason =
      snapshot.generatedAtEpochMillis > this.latestGeneratedAt
        ? "newer"
        : "changed";
    this.commit(snapshot.generatedAtEpochMillis, fingerprint);
    return { accepted: true, reason };
  }

  private commit(generatedAt: number, fingerprint: string) {
    this.latestGeneratedAt = generatedAt;
    this.latestFingerprint = fingerprint;
  }
}

function aircraftFingerprint(snapshot: LiveAircraftSnapshot): string {
  return [...snapshot.aircraft]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((aircraft) => [
      aircraft.id,
      aircraft.latitudeDegrees,
      aircraft.longitudeDegrees,
      aircraft.headingDegrees,
      aircraft.groundSpeedMetersPerSecond,
      aircraft.altitudeMeters,
      aircraft.verticalRateMetersPerSecond,
      aircraft.onGround,
      aircraft.callsign,
      aircraft.registration,
      aircraft.category,
      aircraft.lifecycle,
      aircraft.positionTimestampEpochMillis,
    ].join("|"))
    .join("\n");
}
