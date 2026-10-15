import { useEffect, useState } from 'react';

export interface Coords {
  lat: number;
  lng: number;
}
/** Hyderabad city centre: used when the browser does not share a location. */
export const DEFAULT_CENTER: Coords = { lat: 17.4239, lng: 78.4283 };

type GeoState = { status: 'pending' | 'granted' | 'denied'; coords: Coords | null };

export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'pending', coords: null });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'denied', coords: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'granted', coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
      () => setState({ status: 'denied', coords: null }),
      { timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return state;
}
