// components/TrackingMap.tsx
'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState } from 'react';
import type { TrackingApiResponse, TrackingData } from '@/lib/types';
import './Map.css';

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
};

const currentLocoIcon = L.divIcon({
  html: `<div class="loco-marker-icon"></div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const historyMarkerIcon = L.divIcon({
  html: `<div class="history-marker-icon"></div>`,
  className: "",
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

interface TrackingMapProps {
  currentData: TrackingData;
  historyData: { lat: number, lng: number, timestamp?: string, station?: string, event?: string, speed?: string }[];
}

const TrackingMap = ({ currentData, historyData }: TrackingMapProps) => {
   const [map, setMap] = useState<L.Map | null>(null);
  const currentPosition: [number, number] = [currentData.lat, currentData.lng];
  const historyPositions: [number, number][] = historyData.map(p => [p.lat, p.lng]);

  console.log('Current position:', currentPosition);
  console.log('History positions:', historyPositions);
  console.log('History data length:', historyData.length);

  return (
    <MapContainer center={currentPosition} zoom={13} scrollWheelZoom={true} whenCreated={setMap}>
      <ChangeView center={currentPosition} />
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Draw the track line FIRST (so it's behind markers) */}
      {historyPositions.length > 1 && (
        <Polyline 
          pathOptions={{ 
            color: '#ef4444', // Red color like in your desired output
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5' // Dotted line
          }} 
          positions={historyPositions} 
        />
      )}

      {/* Draw ALL history markers (including the current position if it's in history) */}
      {historyData.map((point, index) => {
        const pos: [number, number] = [point.lat, point.lng];
        // Skip the last position if it's the same as current position
        // We'll render the current position with a different icon
        const isCurrentPosition = point.lat === currentPosition[0] && point.lng === currentPosition[1];
        
        if (isCurrentPosition && index === historyData.length - 1) {
          return null; // Skip this one, we'll render it as the main marker
        }

        return (
          <Marker
            key={`hist-${index}`}
            position={pos}
            icon={historyMarkerIcon}
            zIndexOffset={1000 + index} // Ensure markers are above the line
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="popup-content-container">
                <p><b>Station:</b> {point.station || 'N/A'}</p>
                <p><b>Event:</b> {point.event || 'N/A'}</p>
                <p><b>Speed:</b> {point.speed || 'N/A'}</p>
                <span 
                  className="popup-close-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    const popup = e.currentTarget.closest('.leaflet-popup');
                    if (popup) {
                      const closeBtn = popup.querySelector('.leaflet-popup-close-button') as HTMLElement;
                      if (closeBtn) closeBtn.click();
                    }
                  }}
                >
                  ×
                </span>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Draw the main marker for the current position */}
      <Marker position={currentPosition} icon={currentLocoIcon} zIndexOffset={2000}>
        <Popup className="custom-popup" closeButton={false}>
          <div className="popup-content-container">
            <p><b>Station:</b> {currentData.station}</p>
            <p><b>Event:</b> {currentData.event}</p>
            <p><b>Speed:</b> {currentData.speed}</p>
            <span 
              className="popup-close-btn" 
              onClick={(e) => {
                e.stopPropagation();
                const popup = e.currentTarget.closest('.leaflet-popup');
                if (popup) {
                  const closeBtn = popup.querySelector('.leaflet-popup-close-button') as HTMLElement;
                  if (closeBtn) closeBtn.click();
                }
              }}
            >
              ×
            </span>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default TrackingMap;