// lib/mongodb.js
import { MongoClient } from "mongodb";

// YAHAN 100% same URI daalo jo seed script me hai
const uri = "mongodb+srv://premsagarsharan_db_user:MjLUIWIWmjexwG1K@cluster0.fgokzg9.mongodb.net/?appName=Cluster0";

// Yahi DB name rakho jo seed script me use kiya tha:
const dbName = "sysbyte";

if (!uri) throw new Error("Missing Mongo URI");

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getClient() {
  return clientPromise;
}

export async function getDb() {
  const c = await clientPromise;
  // YAHI pe dbName use ho raha hai (env nahi)
  return c.db(dbName);
}
