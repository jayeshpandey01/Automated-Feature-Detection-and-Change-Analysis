"use client"

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import "leaflet-defaulticon-compatibility";
import { Loader2 } from 'lucide-react'

// Custom Neon Marker Icons
const createNeonIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-neon-marker',
    html: `<div style="
      width: 16px;
      height: 16px;
      background-color: ${color};
      border-radius: 50%;
      box-shadow: 0 0 15px ${color}, 0 0 30px ${color};
      border: 2px solid white;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}

const stableIcon = createNeonIcon('#00f3ff') // neon-cyan
const retreatingIcon = createNeonIcon('#ff003c') // neon-red
const unknownIcon = createNeonIcon('#64748b')

export default function MapComponent() {
  const [mapData, setMapData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMapData() {
      try {
        const res = await fetch('/api/map')
        if (res.ok) {
          const data = await res.json()
          setMapData(data)
        }
      } catch (e) {
        console.error("Failed to load map data", e)
      } finally {
        setLoading(false)
      }
    }
    fetchMapData()
  }, [])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background border border-glass-border rounded-xl">
        <Loader2 className="animate-spin text-neon-cyan" size={32} />
      </div>
    )
  }

  // Centering on Karakoram/Himalayas
  const center: [number, number] = [35.5, 77.0]

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden border border-glass-border shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      <MapContainer 
        center={center} 
        zoom={6} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {mapData.map((glacier) => {
          const isRetreating = glacier.status?.toLowerCase().includes('retreat')
          const colorHex = isRetreating ? '#ff003c' : '#00f3ff'
          const icon = isRetreating ? retreatingIcon : (glacier.status === 'Stable' ? stableIcon : unknownIcon)
          
          // Calculate circle radius in meters based on actual area_km2 (r = 564.19 * sqrt(area))
          const equivalentRadius = 564.19 * Math.sqrt(glacier.area_km2 || 1)
          
          return (
            <div key={glacier.id}>
              {/* Dynamic spatial footprint circle */}
              <Circle 
                center={[glacier.lat, glacier.lon]}
                radius={equivalentRadius}
                pathOptions={{
                  color: colorHex,
                  fillColor: colorHex,
                  fillOpacity: 0.12,
                  weight: 1,
                  dashArray: '3, 5'
                }}
              />
              
              <Marker position={[glacier.lat, glacier.lon]} icon={icon}>
                <Popup className="glass-popup">
                  <div className="p-2 min-w-[220px]">
                    <h3 className="font-serif font-bold text-lg mb-1">{glacier.name}</h3>
                    <p className="text-xs tracking-widest text-muted-foreground uppercase mb-3">{glacier.region} • {glacier.state}</p>
                    
                    <div className="space-y-2 text-sm border-b border-glass-border/30 pb-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Area:</span>
                        <span className="font-mono">{glacier.area_km2} km²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`font-semibold ${isRetreating ? 'text-red-400' : 'text-neon-cyan'}`}>
                          {glacier.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">AI Confidence:</span>
                        <span className="font-mono">{(glacier.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    {glacier.ai_analysis && (
                      <div className="mt-3 pt-1">
                        <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2 uppercase">AI Model Diagnostics</p>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Classifier:</span>
                          <span className="font-mono text-foreground">{glacier.ai_analysis.model_name || "Tabular Model"}</span>
                        </div>
                        {glacier.ai_analysis.classes && (
                          <div className="space-y-1.5 mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Glacier Cover:</span>
                              <span className="font-semibold text-neon-cyan">
                                {glacier.ai_analysis.classes["snow / ice"] !== undefined
                                  ? Math.round(glacier.ai_analysis.classes["snow / ice"])
                                  : glacier.ai_analysis.classes.Ice !== undefined
                                  ? Math.round(glacier.ai_analysis.classes.Ice)
                                  : 85}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-neon-cyan" 
                                style={{
                                  width: `${
                                    glacier.ai_analysis.classes["snow / ice"] !== undefined
                                      ? glacier.ai_analysis.classes["snow / ice"]
                                      : glacier.ai_analysis.classes.Ice !== undefined
                                      ? glacier.ai_analysis.classes.Ice
                                      : 85
                                  }%`
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </div>
          )
        })}
      </MapContainer>
    </div>
  )
}
