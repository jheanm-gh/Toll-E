import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { env } from '@/config/env';
import { colors } from '@/theme/tokens';

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

/**
 * Native map (MapLibre Native). Uses the configured vector style when it loads and falls back
 * to the bundled offline outline when it cannot (no network, tile host down).
 * Requires a development build: MapLibre is not part of Expo Go.
 */
export function TollMap({ plazas, selectedId, onSelect, focus, onStatusChange }: TollMapProps) {
  const [useOffline, setUseOffline] = useState(false);
  const camera = useRef<CameraRef>(null);
  const data = useMemo(() => plazaFeatures(plazas), [plazas]);
  const style = useMemo<string | StyleSpecification>(
    () => (useOffline ? (offlineStyle() as unknown as StyleSpecification) : env.mapStyleUrl),
    [useOffline],
  );

  useEffect(() => {
    onStatusChange?.('loading');
  }, [onStatusChange, useOffline]);

  useEffect(() => {
    if (focus) camera.current?.flyTo({ center: [focus.lng, focus.lat], zoom: 9, duration: 700 });
  }, [focus]);

  return (
    <Map
      style={styles.map}
      mapStyle={style}
      attribution
      attributionPosition={{ bottom: 8, right: 8 }}
      logo={false}
      compass
      compassHiddenFacingNorth
      touchPitch={false}
      tintColor={colors.teal600}
      onDidFinishLoadingMap={() => onStatusChange?.(useOffline ? 'offline' : 'online')}
      onDidFailLoadingMap={() => {
        if (!useOffline) setUseOffline(true);
        else onStatusChange?.('failed');
      }}
      onPress={() => onSelect(null)}>
      <Camera
        ref={camera}
        initialViewState={{ bounds: SOUTH_AFRICA_BOUNDS, padding: { top: 24, bottom: 24, left: 24, right: 24 } }}
        minZoom={3.5}
        maxZoom={15}
      />
      <GeoJSONSource
        id={PLAZA_SOURCE_ID}
        data={data}
        hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }}
        onPress={(e) => {
          e.stopPropagation();
          const id = e.nativeEvent.features[0]?.properties?.id;
          onSelect(typeof id === 'string' ? id : null);
        }}>
        <Layer
          id={PLAZA_HALO_LAYER_ID}
          type="circle"
          filter={haloFilter(selectedId) as never}
          paint={plazaHaloPaint as never}
        />
        <Layer id={PLAZA_LAYER_ID} type="circle" paint={plazaCirclePaint as never} />
      </GeoJSONSource>
    </Map>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
