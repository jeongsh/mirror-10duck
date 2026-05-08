# Vercel Hobby + Personal Mirror Deployment Guide

Team repo (`2yongtech2/10duck`) is the source of truth.
This guide mirrors `main` into a personal private repo and deploys from that repo on Vercel Hobby.

## Architecture

```mermaid
flowchart LR
  A[Team Org Private Repo<br/>2yongtech2/10duck] -->|push main| B[GitHub Actions]
  B -->|mirror sync force push| C[Personal Private Repo]
  C -->|auto deploy trigger| D[Vercel Hobby]
  D --> E[Production URL]
```

## 1) GitHub Actions workflow (already added)

File:
- `.github/workflows/mirror-to-personal.yml`

Trigger:
- `push` on `main`
- `workflow_dispatch` (manual run)

Behavior:
- checks out team repo history
- pushes current `HEAD` to personal repo `main` with `--force`

## 2) Create personal private mirror repo

In your personal GitHub account:
1. Create a new private repository, example: `10duck-mirror`
2. Do not add README/license (empty repo preferred)

## 3) Create token for mirror push

Recommended token type:
- Fine-grained personal access token

Required scope:
- Repository access: only your personal mirror repo
- Permissions: `Contents: Read and write`

## 4) Add secrets to team repo

In `2yongtech2/10duck`:
1. `Settings` -> `Secrets and variables` -> `Actions`
2. Add:
   - `MIRROR_REPO` = `<your-username>/<your-mirror-repo>`
   - `MIRROR_TOKEN` = `<fine-grained-token>`

## 5) Commit and push workflow

PowerShell (Windows):

```powershell
git checkout main
git pull origin main
git add .github/workflows/mirror-to-personal.yml docs/deploy-vercel-hobby-mirror.md
git commit -m "ci: add personal mirror workflow for vercel hobby deploy"
git push origin main
```

Then run once manually:
1. GitHub -> `Actions`
2. Workflow: `Mirror to Personal Repo (for Vercel Hobby)`
3. `Run workflow` on `main`

## 6) Connect personal mirror repo to Vercel Hobby

1. Login to Vercel with personal account
2. `Add New...` -> `Project`
3. Import personal mirror repo
4. Confirm framework (Next.js)
5. Set environment variables
6. Deploy

After this, each team `main` push should flow to Vercel automatically through mirror sync.

## 7) Security checklist

- Keep personal mirror repo private
- Never commit secrets into source files
- Store runtime secrets only in Vercel environment variables
- Use token with minimum scope and short expiration
- Rotate `MIRROR_TOKEN` periodically
- Treat mirror repo as deploy-only (do not edit directly)

## 8) Vercel Hobby constraints (quick)

- Team collaboration and advanced access control are limited
- Resource/usage limits are lower than paid plans
- Good fit for temporary demos and internal preview use

## 9) Alternatives

- Netlify:
  - good free static/frontend deploy
  - Next.js server features can be less straightforward than Vercel
- Railway:
  - easy full-stack hosting
  - free usage and quotas can change, monitor limits

Practical recommendation:
- For this Next.js project and temporary deployment, Vercel + mirror is the most common and stable path.

## 10) End-to-end setup checklist

- [ ] Create personal private mirror repo
- [ ] Create fine-grained token (personal repo write)
- [ ] Set `MIRROR_REPO` and `MIRROR_TOKEN` in team repo secrets
- [ ] Push workflow file to team repo
- [ ] Run workflow once manually and verify mirror repo updated
- [ ] Connect mirror repo to Vercel Hobby
- [ ] Configure Vercel environment variables
- [ ] Verify auto deployment from team repo push
