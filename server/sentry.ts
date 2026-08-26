import * as Sentry from "@sentry/node";

function pathnameOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0];
  }
}

function sanitizeEvent<T extends Sentry.Event>(event: T): T {
  if (event.request) {
    event.request = {
      method: event.request.method,
      url: pathnameOnly(event.request.url),
    };
  }
  event.user = undefined;
  return event;
}

export function getSentryOptions(dsn: string | undefined): Sentry.NodeOptions | null {
  if (!dsn?.trim()) return null;

  return {
    dsn: dsn.trim(),
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    maxBreadcrumbs: 50,
    beforeSend: sanitizeEvent,
    beforeSendTransaction: sanitizeEvent,
  };
}

export function initializeSentry(dsn: string | undefined): boolean {
  const options = getSentryOptions(dsn);
  if (!options) return false;
  Sentry.init(options);
  return true;
}

export function installSentryExpressErrorHandler(app: Parameters<typeof Sentry.setupExpressErrorHandler>[0]): void {
  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.setupExpressErrorHandler(app);
  }
}
