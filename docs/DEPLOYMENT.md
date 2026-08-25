# Skybet Deployment and Secret Management

## Deployment modes

The included `netlify.toml` makes Skybet’s built React application deployable as a static SPA preview. It runs `pnpm build`, publishes `dist/public`, and redirects client-side routes to `index.html`.

> **Limitation:** the current project’s Express/tRPC API, authentication callback, and database access run in a Node server. They are not yet packaged as Netlify Functions. Do not present a static Netlify preview as a production Skybet application; authenticated or regulated functions will not work until a serverless adapter is implemented and tested.

Netlify documents `netlify.toml` as a version-controlled file for build, publish, redirect, and deploy-context configuration.[1] The file can coexist with platform settings, but file-based settings take precedence when values conflict.[1]

## Netlify preview setup

| Step | Action | Expected outcome |
| --- | --- | --- |
| 1 | Create a private GitHub repository and push the approved Skybet commit. | Source control and review history are established. |
| 2 | In Netlify, import the repository as a new project. | Netlify detects the configuration file. |
| 3 | Confirm build command `pnpm build` and publish directory `dist/public`. | The customer UI builds as a static preview. |
| 4 | Test `/` and `/admin` route loading. | SPA routing resolves; `/admin` remains subject to application authentication. |
| 5 | Keep the project non-public until legal, product, and infrastructure gates are complete. | Preview deployment is not mistaken for a public betting service. |

## Environment variable policy

Add secret values in Netlify’s environment-variable UI, CLI, or API, never to committed files. Netlify advises these managed routes for sensitive values and supports deploy-context and scope controls.[2]

| Variable | Classification | Netlify scope | Production notes |
| --- | --- | --- | --- |
| `NEON_DATABASE_URL` | Secret | Functions/runtime only | Add only after the PostgreSQL migration in `NEON_SETUP.md`. |
| `JWT_SECRET` | Secret | Functions/runtime only | Unique per environment; rotate through a planned session invalidation process. |
| Provider API credentials | Secret | Functions/runtime only | Use separate sandbox and production values; never expose through `VITE_*`. |
| `VITE_APP_TITLE` | Public build metadata | Build | Safe to embed in the client bundle. |
| `VITE_APP_URL` | Public build metadata | Build | Use the canonical preview or production URL. |
| Manus system variables | Managed platform variables | Managed deployment only | Do not copy them into another provider without a documented replacement strategy. |

Use separate deploy contexts for production and previews. Restrict production secrets to production functions/runtime and use non-production database branches and provider credentials in previews.[2]

## Full-stack production options

Before production activation, choose one of the following documented paths:

| Path | Fit | Required work |
| --- | --- | --- |
| Keep the current managed full-stack host | Best fit for the existing Express/tRPC template. | Configure custom domain and managed production secrets in the project settings. |
| Adapt to Netlify Functions | Use Netlify for the entire application. | Package Express/tRPC as a function, move OAuth callbacks, add request tests, ensure database pooling, and keep all secrets server-side. |
| Separate static UI and API host | Use Netlify only for UI delivery. | Deploy the API to a compatible Node host, configure CORS, cookies, custom domains, CSRF posture, observability, and secret rotation. |

Do not add payment, wallet, game-provider, KYC, or real-money capabilities to any deployment before jurisdiction-specific professional review and the safety controls in the planning package are implemented.

## References

[1]: https://docs.netlify.com/build/configure-builds/file-based-configuration/ "Netlify Docs - File-based configuration"
[2]: https://docs.netlify.com/build/environment-variables/overview/ "Netlify Docs - Environment variables overview"
