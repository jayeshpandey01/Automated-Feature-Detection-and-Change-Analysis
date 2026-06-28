export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = "mongodb://localhost:27017/";
const dbName = "prediction_db";
const collectionName = "hazard_predictions";

export async function GET() {
  let client;
  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    
    const db = client.db(dbName);
    const col = db.collection(collectionName);
    
    // Sort chronologically (date ascending)
    const predictions = await col.find({}).sort({ date: 1 }).toArray();
    
    return NextResponse.json(predictions);
  } catch (error: any) {
    console.error("Failed to query predictions database:", error);
    return NextResponse.json(
      { error: "Database query failed", details: error.message },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.close();
    }
  }
}
