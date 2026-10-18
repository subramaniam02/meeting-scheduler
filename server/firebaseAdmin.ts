import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { config } from './config.js';

/**
 * Initialize the Firebase Admin SDK.
 *
 * On Cloud Run / AI Studio the service account is picked up automatically
 * via Application Default Credentials, so no key file is needed. Locally,
 * set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON path.
 */
const app: App = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: applicationDefault(),
      projectId: config.projectId,
    });

// Target the named Firestore database when one is configured.
export const db: Firestore = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

export const adminAuth = getAuth(app);
