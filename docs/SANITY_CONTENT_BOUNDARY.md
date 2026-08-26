# SKYBET Sanity content boundary

Sanity will be used only for approved editorial content: help pages, responsible-gaming copy, banners, campaigns, and homepage media metadata. Transactional records remain in Neon and Railway, including customer credentials, sessions, balances, payment proofs, payment requests, withdrawal destinations, betting outcomes, and audit records.

The setup follows Sanity’s MCP-managed project flow: select or create a dedicated project and dataset, deploy the schema, then deploy a hosted Studio. The existing `Datashop` project is unrelated and must not be reused. The schema and GROQ rules were loaded from Sanity’s MCP guidance before setup. Reference: [Sanity Getting Started](https://www.sanity.io/docs/getting-started).

## Provisioning result

A dedicated Sanity project named `SKYBET` was created in the owner’s organization with project ID `5wdyc20a` and the `production` dataset. The MCP-managed `skybet` workspace now contains four editorial document types: `siteSettings`, `editorialPage`, `promoBanner`, and `heroContent`. The hosted Studio is available at [skybet-editorial.sanity.studio](https://skybet-editorial.sanity.studio/). The production Netlify origin was configured as an allowed CORS origin. No API tokens are stored in this repository or this document.
