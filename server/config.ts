import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface AppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
  authDomain?: string;
}

// The applet config file is committed and holds the public Firebase/project IDs.
const appletConfig: AppletConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../firebase-applet-config.json'), 'utf-8')
);

/**
 * Server runtime configuration.
 *
 * Public values come from firebase-applet-config.json (committed).
 * Secrets (the OAuth client secret, state-signing key) come from the
 * environment and must be provided via the AI Studio / Cloud Run secrets panel.
 */
export const config = {
  projectId: appletConfig.projectId,
  firestoreDatabaseId: appletConfig.firestoreDatabaseId,

  // The OAuth client ID is public; prefer the env override if present.
  googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || appletConfig.oAuthClientId || '',

  // SECRET: must be set in the environment. Without it the host cannot
  // connect their calendar and no invites can be sent server-side.
  googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',

  // Public base URL of the deployed app, used to build OAuth redirect URIs.
  // AI Studio / Cloud Run injects APP_URL automatically.
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // Key used to HMAC-sign the OAuth `state` parameter. Falls back to the
  // client secret so a dedicated secret is optional but recommended.
  stateSigningKey:
    process.env.OAUTH_STATE_SIGNING_KEY ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    'insecure-dev-only-state-key',

  port: Number(process.env.PORT) || 3000,
};

export function isCalendarConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export const OAUTH_REDIRECT_PATH = '/api/google/callback';
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
