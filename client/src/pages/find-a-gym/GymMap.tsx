import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import type { Map as MapLibreMapInstance, Marker as MapLibreMarkerInstance, Popup as MapLibrePopup } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import Supercluster from "supercluster";
import type { PointFeature } from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DirectoryListing } from "@shared/directory/types";
import { directionsHref } from "./directions";
import { profileCtaLabel, profileHref, websiteHref } from "./listing-links";
import type { MapBounds } from "./filter";

// Vite serves the MapLibre worker as a static URL (OpenFreeMap quick start).
setWorkerUrl(maplibreWorkerUrl);

/** Free OpenFreeMap style — no API key. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * OpenFreeMap planet tiles only exist through z14. Requests above that return
 * empty 200s, so the canvas goes blank — cap the map there (street detail is available).
 */
const MAP_MAX_ZOOM = 14;
const CLUSTER_MAX_ZOOM = 14;
/** Neighborhood / street-level target when focusing a pin. */
export const DETAIL_ZOOM = 14;

type ClusterProps = {
  id?: string;
  kind?: string;
  name?: string;
  cluster?: boolean;
  point_count?: number;
  cluster_id?: number;
};

export type GymMapHandle = {
  flyTo: (lat: number, lng: number, zoom: number) => void;
  getZoom: () => number;
};

type GymMapProps = {
  listings: readonly DirectoryListing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBounds: (bounds: MapBounds) => void;
  onReady: (handle: GymMapHandle) => void;
};

function readBounds(map: MapLibreMapInstance): MapBounds | null {
  const bounds = map.getBounds();
  if (!bounds) return null;
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "M").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toFeatures(listings: readonly DirectoryListing[]): Array<PointFeature<ClusterProps>> {
  return listings.map((listing) => ({
    type: "Feature",
    properties: {
      id: listing.id,
      kind: listing.kind,
      name: listing.name,
    },
    geometry: {
      type: "Point",
      coordinates: [listing.lng, listing.lat],
    },
  }));
}

function popupHtml(listing: DirectoryListing): string {
  const profile = profileHref(listing);
  const website = websiteHref(listing);
  const directions = directionsHref(listing);
  const logo = listing.image
    ? `<img class="gym-popup__logo" src="${escapeHtml(listing.image)}" alt="" />`
    : `<span class="gym-popup__logo gym-popup__logo--fallback" aria-hidden="true">${escapeHtml(initials(listing.name))}</span>`;
  const address = listing.address
    ? `<p class="gym-popup__address">${escapeHtml(listing.address)}</p>`
    : "";
  const profileLink = profile
    ? `<a class="gym-popup__link" href="${escapeHtml(profile)}">${escapeHtml(profileCtaLabel(listing))}</a>`
    : "";
  const websiteLink = website
    ? `<a class="gym-popup__link" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Visit website</a>`
    : "";
  return `<div class="gym-popup">
    <div class="gym-popup__head">${logo}<div><p class="gym-popup__name">${escapeHtml(listing.name)}</p></div></div>
    ${address}
    <div class="gym-popup__actions">
      <a class="gym-popup__link" href="${escapeHtml(directions)}" target="_blank" rel="noopener noreferrer">Get directions</a>
      ${profileLink}
      ${websiteLink}
    </div>
  </div>`;
}

function clusterSizeClass(count: number): string {
  if (count >= 50) return "is-xl";
  if (count >= 20) return "is-lg";
  if (count >= 8) return "is-md";
  return "is-sm";
}

export function GymMap({ listings, selectedId, onSelect, onBounds, onReady }: GymMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMapInstance | null>(null);
  const markersRef = useRef<MapLibreMarkerInstance[]>([]);
  const indexRef = useRef(
    new Supercluster<ClusterProps>({
      radius: 56,
      maxZoom: CLUSTER_MAX_ZOOM,
      minPoints: 2,
    }),
  );
  const listingsRef = useRef(listings);
  const listingsByIdRef = useRef(new globalThis.Map<string, DirectoryListing>());
  const popupRef = useRef<MapLibrePopup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBounds);
  const onReadyRef = useRef(onReady);
  const selectedIdRef = useRef(selectedId);
  listingsRef.current = listings;
  onSelectRef.current = onSelect;
  onBoundsRef.current = onBounds;
  onReadyRef.current = onReady;
  selectedIdRef.current = selectedId;

  const clearMarkers = () => {
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
  };

  const renderClusters = (map: MapLibreMapInstance) => {
    const bounds = map.getBounds();
    if (!bounds) return;
    const zoom = Math.max(0, Math.floor(map.getZoom()));
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const clusters = indexRef.current.getClusters(bbox, zoom);
    clearMarkers();

    for (const feature of clusters) {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties;
      const el = document.createElement("button");
      el.type = "button";

      if (props.cluster) {
        const count = props.point_count ?? 0;
        el.className = `gym-cluster ${clusterSizeClass(count)}`;
        el.textContent = String(count);
        el.setAttribute("aria-label", `${count} locations`);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          const clusterId = props.cluster_id;
          if (typeof clusterId !== "number") return;
          const expansion = Math.max(
            indexRef.current.getClusterExpansionZoom(clusterId),
            map.getZoom() + 1.5,
          );
          map.easeTo({ center: [lng, lat], zoom: Math.min(expansion, MAP_MAX_ZOOM) });
        });
      } else {
        const id = props.id ?? "";
        el.className = "gym-pin";
        if (props.kind) el.dataset.kind = props.kind;
        if (id && id === selectedIdRef.current) el.classList.add("is-selected");
        el.setAttribute("aria-label", props.name ?? "Location");
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (id) onSelectRef.current(id);
        });
      }

      const marker = new MapLibreMarker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  };

  const rebuildIndex = (map: MapLibreMapInstance, rows: readonly DirectoryListing[]) => {
    listingsByIdRef.current = new globalThis.Map(rows.map((listing) => [listing.id, listing]));
    indexRef.current.load(toFeatures(rows));
    renderClusters(map);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-98.5, 39.8],
      zoom: 3.4,
      minZoom: 2,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
    mapRef.current = map;
    popupRef.current = new Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 18,
      maxWidth: "280px",
      className: "gym-map-popup",
    });

    const emitBounds = () => {
      const bounds = readBounds(map);
      if (bounds) onBoundsRef.current(bounds);
      renderClusters(map);
    };

    map.on("load", () => {
      map.resize();
      rebuildIndex(map, listingsRef.current);
      emitBounds();
    });
    map.on("moveend", emitBounds);
    // First paint before style `load` still needs markers if data is ready.
    rebuildIndex(map, listingsRef.current);

    onReadyRef.current({
      flyTo: (lat, lng, zoom) => {
        map.flyTo({ center: [lng, lat], zoom, essential: true });
      },
      getZoom: () => map.getZoom(),
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    rebuildIndex(map, listings);
  }, [listings]);

  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup) return;
    renderClusters(map);

    if (!selectedId) {
      popup.remove();
      return;
    }

    const listing = listingsByIdRef.current.get(selectedId);
    if (!listing) {
      popup.remove();
      return;
    }

    popup
      .setLngLat([listing.lng, listing.lat])
      .setHTML(popupHtml(listing))
      .addTo(map);
  }, [selectedId, listings]);

  return (
    <div className="gym-map">
      <div ref={containerRef} className="gym-map__canvas" />
    </div>
  );
}
