# @school/web

Next.js app for the School Platform monorepo.

## Development

Run commands from the repository root:

```bash
pnpm --dir school dev
pnpm --dir school build
pnpm --dir school type-check
pnpm --dir school lint
```

Use `pnpm` only. This app receives tenant context from the localhost subdomain and forwards it to the API through `X-Tenant-Subdomain`.
