import React from 'react';
import ReactDOM from 'react-dom';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Maximize2 } from 'lucide-react';
import { colors } from '@docstruc/theme';

interface MapDisplayProps {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

export function MapDisplay({ address, latitude, longitude }: MapDisplayProps) {
  // Use coordinates if available, otherwise geocode the address
  const [mapCoords, setMapCoords] = React.useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    const loadCoordinates = async () => {
      if (latitude && longitude) {
        setMapCoords({ lat: latitude, lon: longitude });
        setLoading(false);
      } else if (address) {
        // Geocode the address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
          );
          const data = await response.json();
          if (data && data.length > 0) {
            setMapCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }
        setLoading(false);
      }
    };

    loadCoordinates();
  }, [address, latitude, longitude]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.addressText}>Karte wird geladen...</Text>
      </View>
    );
  }

  if (!mapCoords) {
    return (
      <View style={styles.container}>
        <Text style={styles.addressText}>Standort konnte nicht ermittelt werden</Text>
      </View>
    );
  }

  // Calculate bounding box (approximately 1km in each direction)
  const delta = 0.01; // roughly 1km
  const bbox = `${mapCoords.lon - delta},${mapCoords.lat - delta},${mapCoords.lon + delta},${mapCoords.lat + delta}`;

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.mapWrapper}>
          <iframe
            width="100%"
            height="300"
            style={{ border: 0, borderRadius: 8 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapCoords.lat}%2C${mapCoords.lon}`}
          />
          <TouchableOpacity style={styles.fullscreenButton} onPress={openFullscreen}>
            <Maximize2 size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.addressText}>{address}</Text>
      </View>

      {/* Fullscreen Modal - Using Portal to ensure it's above everything */}
      {isFullscreen && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 2147483647, // Maximum z-index value
            display: 'flex',
            flexDirection: 'column',
            padding: 20,
            isolation: 'isolate',
          }}
          onClick={closeFullscreen}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 16,
            zIndex: 2147483647,
            position: 'relative'
          }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', zIndex: 2147483647 }}>{address}</Text>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFullscreen();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                zIndex: 2147483647,
                position: 'relative',
              }}
            >
              Schließen
            </button>
          </div>
          <iframe
            width="100%"
            height="100%"
            style={{ 
              border: 0, 
              borderRadius: 8, 
              flex: 1,
              position: 'relative',
              zIndex: 2147483646
            }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${mapCoords.lat}%2C${mapCoords.lon}`}
          />
        </div>,
        document.body
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  mapWrapper: {
    position: 'relative',
  },
  fullscreenButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  addressText: {
    padding: 12,
    fontSize: 14,
    color: '#64748b',
    backgroundColor: '#fff',
  },
});
