/**
 * Copy all Firestore data from a SOURCE project to a DESTINATION project
 * (same document paths and IDs, including subcollections).
 *
 * Firestore only shows a collection after it has at least one document — this script
 * copies whatever exists in the source; empty collections have nothing to copy.
 *
 * You need TWO service account JSON keys:
 *   - One from the SOURCE Firebase project (must be able to read Firestore).
 *   - One from the DESTINATION project (El Rio; must be able to write Firestore).
 *
 * Run from project root:
 *   npx tsx scripts/firestore-migrate.ts --source=./path/to/source-adminsdk.json --dest=./path/to/el-rio-adminsdk.json
 *
 * Or set in .env / .env.local:
 *   FIRESTORE_MIGRATE_SOURCE_KEY=./old-project-adminsdk.json
 *   FIRESTORE_MIGRATE_DEST_KEY=./el-rio-16c18-firebase-adminsdk-....json
 *
 * Options:
 *   --dry-run   List collections and document counts only (no writes).
 */

import { config as loadEnv } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

loadEnv({ path: path.join(process.cwd(), '.env') });
loadEnv({ path: path.join(process.cwd(), '.env.local') });

const APP_SRC = 'firestore-migrate-src';
const APP_DST = 'firestore-migrate-dst';

function resolveKeyPath(p: string): string {
  const trimmed = p.trim();
  if (!trimmed) {
    throw new Error('Missing key path. Use --source= and --dest= or FIRESTORE_MIGRATE_SOURCE_KEY / FIRESTORE_MIGRATE_DEST_KEY.');
  }
  return path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
}

function credentialFromPath(keyPath: string): admin.credential.Credential {
  const abs = resolveKeyPath(keyPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Service account file not found: ${abs}`);
  }
  const json = JSON.parse(fs.readFileSync(abs, 'utf8')) as admin.ServiceAccount;
  return admin.credential.cert(json);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let source = process.env.FIRESTORE_MIGRATE_SOURCE_KEY ?? '';
  let dest = process.env.FIRESTORE_MIGRATE_DEST_KEY ?? '';
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith('--source=')) {
      source = a.slice('--source='.length).trim();
    } else if (a.startsWith('--dest=')) {
      dest = a.slice('--dest='.length).trim();
    } else if (a === '--dry-run') {
      dryRun = true;
    }
  }

  return { source, dest, dryRun };
}

async function countDocRecursive(
  db: admin.firestore.Firestore,
  docRef: admin.firestore.DocumentReference
): Promise<number> {
  const snap = await docRef.get();
  if (!snap.exists) {
    return 0;
  }
  let n = 1;
  const subs = await docRef.listCollections();
  for (const sub of subs) {
    const subSnap = await sub.get();
    for (const d of subSnap.docs) {
      n += await countDocRecursive(db, d.ref);
    }
  }
  return n;
}

async function copyDocRecursive(
  sourceDb: admin.firestore.Firestore,
  destDb: admin.firestore.Firestore,
  docRef: admin.firestore.DocumentReference
): Promise<number> {
  const snap = await docRef.get();
  if (!snap.exists) {
    return 0;
  }
  const data = snap.data();
  if (data === undefined) {
    return 0;
  }

  const destRef = destDb.doc(docRef.path);
  await destRef.set(data);

  let n = 1;
  const subs = await docRef.listCollections();
  for (const sub of subs) {
    const subSnap = await sub.get();
    for (const d of subSnap.docs) {
      n += await copyDocRecursive(sourceDb, destDb, d.ref);
    }
  }
  return n;
}

async function main() {
  const { source, dest, dryRun } = parseArgs();

  if (!source || !dest) {
    console.error(`
Usage:
  npx tsx scripts/firestore-migrate.ts --source=./source-adminsdk.json --dest=./dest-adminsdk.json

Or set FIRESTORE_MIGRATE_SOURCE_KEY and FIRESTORE_MIGRATE_DEST_KEY (paths to JSON files).

Add --dry-run to only list collections and counts.
`);
    process.exit(1);
  }

  const srcCred = credentialFromPath(source);
  const dstCred = credentialFromPath(dest);

  const srcJson = JSON.parse(fs.readFileSync(resolveKeyPath(source), 'utf8')) as { project_id: string };
  const dstJson = JSON.parse(fs.readFileSync(resolveKeyPath(dest), 'utf8')) as { project_id: string };

  if (srcJson.project_id === dstJson.project_id) {
    throw new Error('Source and destination keys are for the same project_id. Use one key per Firebase project.');
  }

  admin.initializeApp({ credential: srcCred }, APP_SRC);
  admin.initializeApp({ credential: dstCred }, APP_DST);

  const sourceDb = admin.app(APP_SRC).firestore();
  const destDb = admin.app(APP_DST).firestore();

  console.log(`Source project: ${srcJson.project_id}`);
  console.log(`Destination project: ${dstJson.project_id}`);
  if (dryRun) {
    console.log('DRY RUN — no writes.\n');
  }

  const collections = await sourceDb.listCollections();
  if (collections.length === 0) {
    console.log('Source has no top-level collections with data.');
    process.exit(0);
  }

  let grandTotal = 0;

  for (const col of collections) {
    const snap = await col.get();
    let colTotal = 0;
    for (const doc of snap.docs) {
      if (dryRun) {
        colTotal += await countDocRecursive(sourceDb, doc.ref);
      } else {
        colTotal += await copyDocRecursive(sourceDb, destDb, doc.ref);
      }
    }
    grandTotal += colTotal;
    console.log(`  ${col.id}: ${colTotal} document(s) (including subcollections)`);
  }

  console.log(`\n${dryRun ? 'Would copy' : 'Copied'} ${grandTotal} document(s) total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
