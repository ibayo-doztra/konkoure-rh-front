/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import i18next from "i18next";

export type LatLng = { lat: number; lng: number };
export type ZoneShape =
  | { shape: "circle"; center: LatLng; radius: number }
  | { shape: "polygon"; points: LatLng[] };

type ExistingZone = {
  id: string;
  name: string;
  shape: "circle" | "polygon";
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  polygon: LatLng[] | null;
};

interface Props {
  mode: "circle" | "polygon";
  draft: ZoneShape | null;
  onDraftChange: (d: ZoneShape | null) => void;
  existing: ExistingZone[];
  center?: LatLng;
  userLocation?: LatLng | null;
  onUserLocationChange?: (p: LatLng) => void;
}

const DRAFT_COLOR = "#7c3aed"; // violet
const EXISTING_COLOR = "#16a34a"; // vert
const USER_COLOR = "#3b82f6"; // bleu
const CONAKRY: LatLng = { lat: 9.6412, lng: -13.5784 };

let googleMapsLoader: Promise<typeof google> | null = null;

function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (googleMapsLoader) return googleMapsLoader;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
    | string
    | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
    | string
    | undefined;
  if (!key) return Promise.reject(new Error("Google Maps browser key manquante"));

  googleMapsLoader = new Promise((resolve, reject) => {
    const cbName = "__lovableInitGmap";
    (window as any)[cbName] = () => {
      resolve((window as any).google);
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      libraries: "geometry",
      callback: cbName,
    });
    if (channel) params.set("channel", channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Impossible de charger Google Maps"));
    document.head.appendChild(script);
  });
  return googleMapsLoader;
}

export function WorkZoneMap({
  mode,
  draft,
  onDraftChange,
  existing,
  center,
  userLocation,
  onUserLocationChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const draftOverlayRef = useRef<google.maps.Circle | google.maps.Polygon | null>(null);
  const draftPointMarkersRef = useRef<google.maps.Marker[]>([]);
  const existingOverlaysRef = useRef<Array<google.maps.Circle | google.maps.Polygon>>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const initialFitDoneRef = useRef(false);

  const onDraftChangeRef = useRef(onDraftChange);
  const onUserLocationChangeRef = useRef(onUserLocationChange);
  const modeRef = useRef(mode);
  const draftRef = useRef(draft);

  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);
  useEffect(() => {
    onUserLocationChangeRef.current = onUserLocationChange;
  }, [onUserLocationChange]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = new g.maps.Map(containerRef.current, {
          center: center ?? CONAKRY,
          zoom: 13,
          mapTypeId: g.maps.MapTypeId.HYBRID,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: g.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            mapTypeIds: [
              g.maps.MapTypeId.ROADMAP,
              g.maps.MapTypeId.SATELLITE,
              g.maps.MapTypeId.HYBRID,
              g.maps.MapTypeId.TERRAIN,
            ],
          },
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;

        clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          const m = modeRef.current;
          const d = draftRef.current;
          if (m === "circle") {
            onDraftChangeRef.current({
              shape: "circle",
              center: { lat, lng },
              radius: d?.shape === "circle" ? d.radius : 100,
            });
          } else {
            const pts =
              d?.shape === "polygon" ? [...d.points, { lat, lng }] : [{ lat, lng }];
            onDraftChangeRef.current({ shape: "polygon", points: pts });
          }
        });

        // Auto-locate on first load if no explicit center
        if (!center && typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              mapRef.current?.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              mapRef.current?.setZoom(16);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 8000 },
          );
        }

        // Force re-render effects
        renderExistingRef.current?.();
        renderDraftRef.current?.();
        renderUserRef.current?.();
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;
      draftOverlayRef.current?.setMap(null);
      draftOverlayRef.current = null;
      draftPointMarkersRef.current.forEach((m) => m.setMap(null));
      draftPointMarkersRef.current = [];
      existingOverlaysRef.current.forEach((o) => o.setMap(null));
      existingOverlaysRef.current = [];
      userMarkerRef.current?.setMap(null);
      userMarkerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(16);
    }
  }, [center]);

  // Draft rendering
  const renderDraftRef = useRef<() => void>(() => {});
  renderDraftRef.current = () => {
    const map = mapRef.current;
    const g = (window as any).google as typeof google | undefined;
    if (!map || !g) return;

    draftOverlayRef.current?.setMap(null);
    draftOverlayRef.current = null;
    draftPointMarkersRef.current.forEach((m) => m.setMap(null));
    draftPointMarkersRef.current = [];

    if (!draft) return;
    if (draft.shape === "circle") {
      const c = new g.maps.Circle({
        map,
        center: draft.center,
        radius: draft.radius,
        strokeColor: DRAFT_COLOR,
        fillColor: DRAFT_COLOR,
        fillOpacity: 0.2,
        strokeWeight: 2,
        clickable: false,
      });
      draftOverlayRef.current = c;
    } else if (draft.points.length > 0) {
      draft.points.forEach((p, i) => {
        const marker = new g.maps.Marker({
          map,
          position: p,
          label: { text: String(i + 1), color: "#fff", fontSize: "11px" },
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: DRAFT_COLOR,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        draftPointMarkersRef.current.push(marker);
      });
      if (draft.points.length >= 3) {
        const poly = new g.maps.Polygon({
          map,
          paths: draft.points,
          strokeColor: DRAFT_COLOR,
          fillColor: DRAFT_COLOR,
          fillOpacity: 0.2,
          strokeWeight: 2,
          clickable: false,
        });
        draftOverlayRef.current = poly;
      }
    }
  };
  useEffect(() => {
    renderDraftRef.current();
  }, [draft]);

  // Existing zones
  const renderExistingRef = useRef<() => void>(() => {});
  renderExistingRef.current = () => {
    const map = mapRef.current;
    const g = (window as any).google as typeof google | undefined;
    if (!map || !g) return;

    existingOverlaysRef.current.forEach((o) => o.setMap(null));
    existingOverlaysRef.current = [];

    const bounds = new g.maps.LatLngBounds();
    let hasBounds = false;

    existing.forEach((z) => {
      if (z.shape === "circle" && z.latitude != null && z.longitude != null) {
        const c = new g.maps.Circle({
          map,
          center: { lat: z.latitude, lng: z.longitude },
          radius: z.radius_meters ?? 100,
          strokeColor: EXISTING_COLOR,
          fillColor: EXISTING_COLOR,
          fillOpacity: 0.15,
          strokeWeight: 2,
        });
        const iw = new g.maps.InfoWindow({ content: `<b>${z.name}</b>` });
        c.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            iw.setPosition(e.latLng);
            iw.open(map);
          }
        });
        existingOverlaysRef.current.push(c);
        const b = c.getBounds();
        if (b) {
          bounds.union(b);
          hasBounds = true;
        }
      } else if (z.shape === "polygon" && z.polygon && z.polygon.length >= 3) {
        const poly = new g.maps.Polygon({
          map,
          paths: z.polygon,
          strokeColor: EXISTING_COLOR,
          fillColor: EXISTING_COLOR,
          fillOpacity: 0.15,
          strokeWeight: 2,
        });
        const iw = new g.maps.InfoWindow({ content: `<b>${z.name}</b>` });
        poly.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            iw.setPosition(e.latLng);
            iw.open(map);
          }
        });
        existingOverlaysRef.current.push(poly);
        z.polygon.forEach((p) => {
          bounds.extend(p);
          hasBounds = true;
        });
      }
    });

    if (hasBounds && !draft && !center && !initialFitDoneRef.current) {
      map.fitBounds(bounds, 40);
      initialFitDoneRef.current = true;
    }
  };
  useEffect(() => {
    renderExistingRef.current();
  }, [existing, draft, center]);

  // User marker (draggable)
  const renderUserRef = useRef<() => void>(() => {});
  renderUserRef.current = () => {
    const map = mapRef.current;
    const g = (window as any).google as typeof google | undefined;
    if (!map || !g) return;

    userMarkerRef.current?.setMap(null);
    userMarkerRef.current = null;

    if (!userLocation) return;
    const marker = new g.maps.Marker({
      map,
      position: userLocation,
      draggable: true,
      title: i18next.t("zones.userLocationTitle"),
      icon: {
        path: g.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: USER_COLOR,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
      zIndex: 1000,
    });
    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) onUserLocationChangeRef.current?.({ lat: pos.lat(), lng: pos.lng() });
    });
    userMarkerRef.current = marker;
    map.setCenter(userLocation);
    if ((map.getZoom() ?? 0) < 16) map.setZoom(17);
  };
  useEffect(() => {
    renderUserRef.current();
  }, [userLocation]);

  return <div ref={containerRef} className="h-[500px] w-full rounded-lg border" />;
}
