import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // On Web (PC or Mobile Browser on LAN), use the same hostname that served the web app
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:5000/api/v1`;
  }

  // On Native (Expo Go on iOS/Android), extract LAN IP from Expo hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const lanHost = hostUri.split(":")[0];
    if (lanHost) {
      return `http://${lanHost}:5000/api/v1`;
    }
  }

  return "http://localhost:5000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();
