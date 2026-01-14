import { useMemo } from "react";
import { createLocalNotesService } from "../services/localNotesService";
import { createRestNotesService } from "../services/restNotesService";

/**
 * Selects which notes service to use.
 * Defaults to localStorage, switches to REST if REACT_APP_API_BASE or REACT_APP_BACKEND_URL is configured.
 */
// PUBLIC_INTERFACE
export function useNotesService() {
  const baseUrl =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    "";

  return useMemo(() => {
    const trimmed = String(baseUrl || "").trim();
    if (trimmed) {
      return createRestNotesService(trimmed);
    }
    return createLocalNotesService();
  }, [baseUrl]);
}
