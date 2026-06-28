import { NextResponse } from 'next/server';
import { MongoClient, ObjectId, GridFSBucket } from 'mongodb';
import { Readable } from 'stream';

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/";
const dbName = process.env.MONGODB_DB_NAME || "glacier_india_db";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: imageId } = await params;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  
  try {
    if (!ObjectId.isValid(imageId)) {
      return new NextResponse('Invalid image id', { status: 400 });
    }

    await client.connect();
    const db = client.db(dbName);
    const bucket = new GridFSBucket(db);
    
    const id = new ObjectId(imageId);
    
    // Check if file exists
    const files = await db.collection('fs.files').find({ _id: id }).toArray();
    if (files.length === 0) {
      return new NextResponse('Image not found', { status: 404 });
    }
    
    const file = files[0];
    
    // Set appropriate content type
    let contentType = file.contentType || 'image/jpeg';
    if (!file.contentType && file.filename && file.filename.toLowerCase().endsWith('.png')) {
      contentType = 'image/png';
    }
    if (!file.contentType && file.metadata && file.metadata.type === 'image/png') {
      contentType = 'image/png';
    }
    
    // Read GridFS stream fully for reliable NextResponse delivery in route handlers.
    const downloadStream = bucket.openDownloadStream(id);
    const body = await streamToBuffer(downloadStream as unknown as Readable);
    
    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return new NextResponse('Internal Server Error', { status: 500 });
  } finally {
    await client.close();
  }
}
