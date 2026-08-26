import "dotenv/config";
import { initializeSentry } from "./sentry";

initializeSentry(process.env.SENTRY_DSN);
