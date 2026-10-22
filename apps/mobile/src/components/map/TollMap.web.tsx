import 'maplibre-gl/dist/maplibre-gl.css';

import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';

import { env } from '@/config/env';

import {
  PLAZA_HALO_LAYER_ID,
  PLAZA_LAYER_ID,
  PLAZA_SOURCE_ID,
  SOUTH_AFRICA_BOUNDS,
  haloFilter,
  offlineStyle,
  plazaCirclePaint,
  plazaFeatures,
  plazaHaloPaint,
} from './map-style';
import type { TollMapProps } from './TollMap.types';

const STYLE_TIMEOUT_MS = 8000;

/**
 * Web map (MapLibre GL JS). Same layers as the native map. Falls back to the bundled offline
 * outline if the online style does not load in time, and reports 'failed' if WebGL is
 * unavailable so the screen can switch to the list.
 */
export function TollMap({ plazas, selectedId, onSelect, focus, onStatusChange }: TollMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const data = useMemo(() => plazaFeatures(plazas), [plazas]);
  const latest = useRef({ data, selectedId, onSelect, onStatusChange });
  useEffect(() => {
    latest.current = { data, selectedId, onSelect, onStatusChange };
  });

  useEffect(() => {
    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !container.current) return;
      // Served from public/ (see scripts/copy-map-worker.mjs); Metro cannot resolve the default.
      maplibregl.setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`);
      latest.current.onStatusChange?.('loading');
      const startOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      let offline = startOffline;
      let map: MapLibreMap;
      try {
        map = new maplibregl.Map({
          container: container.current,
          style: startOffline ? (offlineStyle() as unknown as StyleSpecification) : env.mapStyleUrl,
          bounds: SOUTH_AFRICA_BOUNDS,
          fitBoundsOptions: { padding: 24 },
          minZoom: 3.5,
          maxZoom: 15,
          pitchWithRotate: false,
          dragRotate: false,
          attributionControl: { compact: true },
        });
      } catch {
        latest.current.onStatusChange?.('failed');
        return;
      }
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      const switchToOfflineStyle = () => {
        if (offline) return;
        offline = true;
        map.setStyle(offlineStyle() as unknown as StyleSpecification);
      };
      fallbackTimer = setTimeout(() => {
        if (!map.isStyleLoaded()) switchToOfflineStyle();
      }, STYLE_TIMEOUT_MS);
      map.on('error', (e) => {
        // A failed style or tile request before the style is ready means the online map is unusable.
        if (!map.isStyleLoaded() && !offline) switchToOfflineStyle();
        else if (offline && !map.isStyleLoaded()) latest.current.onStatusChange?.('failed');
        void e;
      });

      const addPlazaLayers = () => {
        if (map.getSource(PLAZA_SOURCE_ID)) return;
        map.addSource(PLAZA_SOURCE_ID, { type: 'geojson', data: latest.current.data });
        map.addLayer({
          id: PLAZA_HALO_LAYER_ID,
          type: 'circle',
          source: PLAZA_SOURCE_ID,
          filter: haloFilter(latest.current.selectedId) as never,
          paint: plazaHaloPaint as never,
        });
        map.addLayer({ id: PLAZA_LAYER_ID, type: 'circle', source: PLAZA_SOURCE_ID, paint: plazaCirclePaint as never });
        latest.current.onStatusChange?.(offline ? 'offline' : 'online');
      };
      map.on('style.load', addPlazaLayers);
      map.on('click', (e) => {
        const hit = map.queryRenderedFeatures(
          [
            [e.point.x - 14, e.point.y - 14],
            [e.point.x + 14, e.point.y + 14],
          ],
          { layers: [PLAZA_LAYER_ID] },
        )[0];
        const id = hit?.properties?.id;
        latest.current.onSelect(typeof id === 'string' ? id : null);
      });
      map.on('mousemove', (e) => {
        const over = map.getLayer(PLAZA_LAYER_ID)
          ? map.queryRenderedFeatures(e.point, { layers: [PLAZA_LAYER_ID] }).length > 0
          : false;
        map.getCanvas().style.cursor = over ? 'pointer' : '';
      });
    })();
    return () => {
      cancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const src = mapRef.current?.getSource(PLAZA_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(data);
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(PLAZA_HALO_LAYER_ID)) map.setFilter(PLAZA_HALO_LAYER_ID, haloFilter(selectedId) as never);
  }, [selectedId]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: 9, duration: 700 });
  }, [focus]);

  return (
    <div
      ref={container}
      role="application"
      aria-label="Map of toll plazas. Use the list view for a text alternative."
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
