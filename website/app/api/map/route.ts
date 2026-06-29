export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

// Robust path helper to locate data files
function getGeoJsonFromDisk() {
  const paths = [
    path.join(process.cwd(), "..", "output", "latest_geojson.json"),
    path.join(process.cwd(), "..", "src", "dataset_pipline", "output", "latest_geojson.json"),
    path.join(process.cwd(), "..", "src", "dataset_pipline", "latest_geojson.json"),
    path.join(process.cwd(), "src", "dataset_pipline", "output", "latest_geojson.json"),
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.features) {
          return parsed.features.map((feature: any) => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [0, 0];
            return {
              id: props.glacier_id || feature.id,
              name: props.name || "Unnamed Glacier",
              lat: props.lat || coords[1],
              lon: props.lon || coords[0],
              area_km2: props.area_km2 || 0,
              status: props.status || "Monitoring",
              confidence: props.ai_analysis?.confidence || 0.95,
              region: props.region || "Himalaya",
              state: props.state || "India",
              ai_analysis: props.ai_analysis || null,
            };
          }).filter((g: any) => g.lat && g.lon);
        }
      } catch (err) {
        console.error(`Error parsing geojson file at ${p}:`, err);
      }
    }
  }
  return null;
}

export async function GET() {
  // 1. Try MongoDB first (using shared singleton)
  try {
    const client = await clientPromise;
    const db = client.db('glacier_india_db');
    
    // Fetch all processed glaciers
    const glaciers = await db.collection('glaciers_processed').find().toArray();
    
    if (glaciers && glaciers.length > 0) {
      // Map them to a safe JSON format for the frontend
      const mapData = glaciers.map((g) => {
        return {
          id: g.glacier_id,
          name: g.name || g.glacier_id,
          lat: g.lat,
          lon: g.lon,
          area_km2: g.area_km2,
          status: g.status || g.change_analysis?.change_status || 'Unknown',
          confidence: g.ai_analysis?.confidence || 0.95,
          region: g.region,
          state: g.state,
          ai_analysis: g.ai_analysis || null,
        };
      }).filter(g => g.lat && g.lon); // Only include those with coordinates

      return NextResponse.json(mapData);
    }
  } catch (error) {
    console.error("Failed to fetch map data from MongoDB (falling back to file system):", error);
  }

  // 2. Try file system fallback (most reliable & fresh for local runs if DB is empty/offline)
  const fileData = getGeoJsonFromDisk();
  if (fileData && fileData.length > 0) {
    return NextResponse.json(fileData);
  }

  // 3. MOCK DATA FALLBACK for when MongoDB and files are both offline/empty
    const mockMapData = [
      {
        id: "mock-1",
        name: "Baltoro Glacier",
        lat: 35.7333,
        lon: 76.4167,
        area_km2: 630.0,
        status: "Retreating",
        confidence: 0.98,
        region: "Karakoram",
        state: "Gilgit-Baltistan",
        ai_analysis: {
          confidence: 0.98,
          classes: { "Ice": 82, "Non-Ice": 18 },
          model_name: "Mock Classifier"
        }
      },
      {
        id: "mock-2",
        name: "Siachen Glacier",
        lat: 35.5,
        lon: 77.0,
        area_km2: 700.0,
        status: "Monitoring",
        confidence: 0.95,
        region: "Karakoram",
        state: "Ladakh",
        ai_analysis: {
          confidence: 0.95,
          classes: { "Ice": 91, "Non-Ice": 9 },
          model_name: "Mock Classifier"
        }
      },
      {
        id: "mock-3",
        name: "Gangotri Glacier",
        lat: 30.83,
        lon: 79.16,
        area_km2: 155.0,
        status: "Retreating",
        confidence: 0.99,
        region: "Garhwal",
        state: "Uttarakhand",
        ai_analysis: {
          confidence: 0.99,
          classes: { "Ice": 78, "Non-Ice": 22 },
          model_name: "Mock Classifier"
        }
      }
    ];

    return NextResponse.json(mockMapData);
  // NOTE: No client.close() — singleton manages lifecycle
}
