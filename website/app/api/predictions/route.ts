export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const dbName = "prediction_db";
const collectionName = "hazard_predictions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // ── Parse query params ──────────────────────────
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // ── Build date filter ──────────────────────────
    const dateFilter: Record<string, any> = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;

    const query: Record<string, any> = {};
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }

    // ── Count total for pagination ─────────────────
    const total = await col.countDocuments(query);

    // ── Fetch paginated, sorted chronologically ────
    const predictions = await col
      .find(query)
      .sort({ date: 1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    
    return NextResponse.json({
      data: predictions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error: any) {
    console.error("Failed to query predictions database:", error);
    return NextResponse.json(
      { error: "Database query failed", details: error.message },
      { status: 500 }
    );
  }
  // NOTE: No client.close() — singleton manages lifecycle
}
