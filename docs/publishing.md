# Publishing the npm package

The `biatec-concentrated-liquidity-amm` package is published to npm via the
[`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml) GitHub Actions
workflow. It runs the same two steps you'd run locally:

```
npm run build-package
npm run publish-package
```

## Triggers

The workflow runs automatically when a **GitHub Release is published**. It can also be run
manually from the Actions tab (`workflow_dispatch`) if you need to re-publish without cutting a
new release.

## One-time setup: NPM_TOKEN secret

The workflow authenticates to npm using a repository secret named `NPM_TOKEN`. Without it,
`npm run publish-package` (i.e. `npm publish`) will fail with a 401/403 error.

### 1. Create an npm access token

1. Log in to [npmjs.com](https://www.npmjs.com/) with an account that has publish rights to
   `biatec-concentrated-liquidity-amm` (owner or maintainer).
2. Go to **Profile → Access Tokens → Generate New Token → Granular Access Token** (or
   "Automation" token type on older UIs).
3. Configure the token:
   - **Type**: Automation (bypasses 2FA prompts, safe for CI) or Granular with "Read and write"
     permission scoped to this package only.
   - **Expiration**: set a reasonable expiry and add a calendar reminder to rotate it.
   - **Packages**: restrict to `biatec-concentrated-liquidity-amm` if using a granular token.
4. Copy the generated token (starts with `npm_...`). It is shown only once.

### 2. Add the token as a GitHub Actions secret

1. In the GitHub repo, go to **Settings → Secrets and variables → Actions → New repository
   secret**.
2. Name: `NPM_TOKEN`
3. Value: paste the token copied above.
4. Save.

Repository admin access is required to add secrets. If you don't have it, ask a repo owner to
add the secret for you (or add it as an org-level secret shared across repos).

### 3. Verify

- Publish a GitHub Release (or trigger the workflow manually) and check the
  **Actions → Publish npm package** run.
- On success, the new version should appear at
  https://www.npmjs.com/package/biatec-concentrated-liquidity-amm.

## Notes

- Make sure `package.json`'s `version` field is bumped before publishing — npm rejects
  publishing a version that already exists.
- The workflow only runs `build-package` (bundling `src/index.ts` with `tsup`), not the full
  smart-contract build (`compile-contract`/`generate-client`), since those artifacts are already
  committed to the repo and aren't needed to publish the npm package.
