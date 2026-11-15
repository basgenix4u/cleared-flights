import { providerMode } from "../config";
import { demoProvider } from "./demo";
import { duffelProvider } from "./duffel";
import type { FlightProvider } from "./types";

export function getProvider(): FlightProvider {
  const mode = providerMode();
  return mode === "demo" ? demoProvider : duffelProvider(mode);
}

export { ProviderError } from "./types";
