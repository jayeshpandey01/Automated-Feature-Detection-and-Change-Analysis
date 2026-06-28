/**
 * MongoDB Connection Singleton
 * 
 * Reuses a single MongoClient across all API routes and hot-reloads
 * in Next.js dev mode. This eliminates the ~500ms–2s overhead of
 * creating a new TCP connection on every request.
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/";

const options = {
  serverSelectionTimeoutMS: 2000,
  connectTimeoutMS: 2000,
  maxPoolSize: 5,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// In development, use a global variable so the client survives HMR
if (process.env.NODE_ENV === 'development') {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
