import "dotenv/config";
import * as Sentry from "@sentry/node";

function pathnameOnly(value) {
  if (!value) return undefined;
  try {
    return new URL(value).pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0];
  }
}

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    maxBreadcrumbs: 50,
    beforeSend(event) {
      if (event.request) {
        event.request = {
          method: event.request.method,
          url: pathnameOnly(event.request.url),
        };
      }
      event.user = undefined;
      return event;
    },
    beforeSendTransaction(event) {
      if (event.request) {
        event.request = {
          method: event.request.method,
          url: pathnameOnly(event.request.url),
        };
      }
      event.user = undefined;
      return event;
    },
  });
}
