
import admin from 'firebase-admin';

// This is a workaround for Vercel/Next.js not parsing the service account key from env vars correctly.
// In a real production environment, you would use environment variables.
let serviceAccount;
try {
  serviceAccount = require('../../../serviceAccountKey.json');
} catch (e) {
  console.log("serviceAccountKey.json not found, trying environment variables.");
}


const firebaseConfig = {
  credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) 
    : serviceAccount
  ),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};


if (!admin.apps.length) {
  admin.initializeApp(firebaseConfig);
}

const adminDb = admin.firestore();
const adminStorage = admin.storage();

export { adminDb, adminStorage };
