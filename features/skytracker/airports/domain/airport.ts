export type Airport = Readonly<{
  icaoCode: string | null;
  iataCode: string | null;
  name: string;
  latitudeDegrees: number;
  longitudeDegrees: number;
  countryCode: string | null;
}>;

export type AirportSearchEntry = Readonly<{
  airport: Airport;
  city: string | null;
}>;

export type AirportRunway = Readonly<{
  designation: string;
  lengthMeters: number | null;
  surface: string | null;
}>;

export type AirportDetails = Readonly<{
  airport: Airport;
  city: string | null;
  elevationMeters: number | null;
  timezone: string | null;
  runways: readonly AirportRunway[];
}>;

