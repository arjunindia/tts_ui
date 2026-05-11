import { registerRootComponent } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { ErrorInfo } from 'react-native';

import App from './App';

// ─── Global crash/error logger ─────────────────────────────────────────────────
// Catches uncaught JS errors and writes them to crash.log.
// Native crashes (SIGSEGV, OOM kills) won't be caught here — for those
// you need device console logs or Sentry. But console.error and unhandled
// promise rejections ARE caught.

const LOG_PATH = (FileSystem.documentDirectory ?? '') + 'crash.log';

async function appendCrashLog(msg: string) {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${msg}\n\n`;
    const existing = await FileSystem.readAsStringAsync(LOG_PATH, {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => '');
    // Keep last 8KB of history so the file doesn't grow forever
    const combined = (existing + entry).slice(-8192);
    await FileSystem.writeAsStringAsync(LOG_PATH, combined, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // logging must never throw
  }
}

async function crashHandler(error: unknown, isFatal: boolean) {
  const tag = isFatal ? 'FATAL' : 'ERROR';
  let message = tag;
  let stack: string | undefined;

  if (error instanceof Error) {
    message += `: ${error.message}`;
    stack = error.stack;
  } else if (typeof error === 'string') {
    message += `: ${error}`;
  } else if (error) {
    message += `: ${JSON.stringify(error)}`;
  }

  const full = stack ? `${message}\n${stack}` : message;
  console.error('[crash]', full);
  await appendCrashLog(full);
}

// Catch uncaught JS errors
const origHandler = ErrorUtils.getGlobalHandler?.();
ErrorUtils.setGlobalHandler?.((error, isFatal, stackTrace) => {
  crashHandler(error, isFatal);
  origHandler?.(error, isFatal, stackTrace);
});

// Catch unhandled promise rejections
process.on?.('unhandledRejection', (reason) => {
  crashHandler(reason, false);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
