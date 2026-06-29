export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

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

    const tasks = await db
      .collection('tasks')
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ success: true, tasks });
  } catch (err: any) {
    console.error('Error fetching tasks:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { grid_name, subject, date, status, priority, assigned_to, description } = body;

    if (!grid_name || !subject) {
      return NextResponse.json({ success: false, error: 'Grid context and subject are required.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('prediction_db');

    const taskRecord = {
      grid_name,
      subject,
      date: date || new Date().toISOString().split('T')[0],
      status: status || 'Open',
      priority: priority || 'Normal',
      assigned_to: assigned_to || 'Science Team',
      description: description || '',
      created_at: new Date()
    };

    const result = await db.collection('tasks').insertOne(taskRecord);

    return NextResponse.json({ success: true, taskId: result.insertedId, task: taskRecord });
  } catch (err: any) {
    console.error('Error creating task:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
