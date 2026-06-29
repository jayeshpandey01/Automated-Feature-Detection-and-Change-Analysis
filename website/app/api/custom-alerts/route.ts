export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gridName = searchParams.get('gridName');

  try {
    const client = await clientPromise;
    const db = client.db('prediction_db');

    const query: Record<string, any> = {};
    if (gridName) {
      query.grid_name = gridName;
    }

    const alerts = await db
      .collection('custom_alerts')
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ success: true, alerts });
  } catch (err: any) {
    console.error('Error fetching custom alerts:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { grid_name, glacier_id, subject, date, priority, description } = body;

    if (!grid_name || !subject) {
      return NextResponse.json({ success: false, error: 'Grid context and subject are required.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('prediction_db');

    const alertRecord = {
      grid_name,
      glacier_id: glacier_id || '',
      subject,
      date: date || new Date().toISOString().split('T')[0],
      priority: priority || 'Normal',
      description: description || '',
      created_at: new Date()
    };

    const result = await db.collection('custom_alerts').insertOne(alertRecord);

    // If critical/high alert, trigger email notifications
    let emailStatus = 'skipped';
    if (priority === 'Critical' || priority === 'High') {
      try {
        // Find a matching glacier_id from db or backend if not provided
        let targetGlacierId = glacier_id;
        if (!targetGlacierId) {
          // Attempt to find any valid glacier_id in predictions or processed glaciers to trigger SMTP alert
          const pred = await db.collection('hazard_predictions').findOne({ grid_name });
          targetGlacierId = pred?.glacier_id || pred?.id || 'gangotri';
        }

        const backendRes = await fetch(`${BACKEND_API_URL}/api/auth/trigger-alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            glacier_id: targetGlacierId,
            risk_level: priority.toUpperCase()
          })
        });

        if (backendRes.ok) {
          const backendData = await backendRes.json();
          emailStatus = `sent (${backendData.emails_sent} emails)`;
        } else {
          emailStatus = `failed (backend responded status ${backendRes.status})`;
        }
      } catch (triggerErr: any) {
        console.error('Failed to trigger email notification:', triggerErr);
        emailStatus = `error (${triggerErr.message})`;
      }
    }

    return NextResponse.json({
      success: true,
      alertId: result.insertedId,
      alert: alertRecord,
      emailStatus
    });
  } catch (err: any) {
    console.error('Error creating custom alert:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
