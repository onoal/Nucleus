# GitHub Release Commands

## Create Releases via GitHub CLI

### Option 1: Using GitHub CLI (gh)

#### v0.1.0-beta

```bash
gh release create v0.1.0-beta \
  --title "🎉 v0.1.0-beta: Initial TypeScript Beta Release" \
  --notes-file GITHUB_RELEASE_v0.1.0-beta.md \
  --prerelease \
  --target release/v0.1.0-beta
```

#### v0.1.1-beta

```bash
gh release create v0.1.1-beta \
  --title "🐛 v0.1.1-beta: CommonJS Compatibility Fix" \
  --notes-file GITHUB_RELEASE_v0.1.1-beta.md \
  --prerelease \
  --target release/v0.1.0-beta
```

---

### Option 2: Manual via GitHub Web UI

1. Go to: https://github.com/onoal/Nucleus/releases/new

2. **For v0.1.0-beta:**
   - Tag: `v0.1.0-beta`
   - Target: `release/v0.1.0-beta` branch
   - Title: `🎉 v0.1.0-beta: Initial TypeScript Beta Release`
   - Description: Copy content from `GITHUB_RELEASE_v0.1.0-beta.md`
   - ✅ Check "This is a pre-release"
   - Click "Publish release"

3. **For v0.1.1-beta:**
   - Tag: `v0.1.1-beta`
   - Target: `release/v0.1.0-beta` branch
   - Title: `🐛 v0.1.1-beta: CommonJS Compatibility Fix`
   - Description: Copy content from `GITHUB_RELEASE_v0.1.1-beta.md`
   - ✅ Check "This is a pre-release"
   - Click "Publish release"

---

## Quick Links

- **Releases Page:** https://github.com/onoal/Nucleus/releases
- **Release Branch:** https://github.com/onoal/Nucleus/tree/release/v0.1.0-beta
- **npm Package:** https://www.npmjs.com/package/@onoal/nucleus

---

## After Publishing Releases

1. **Verify releases:**

   ```bash
   gh release list
   ```

2. **Update main README** (optional):

   ```bash
   git checkout main
   # Add link to beta branch/releases
   git commit -m "docs: add link to TypeScript beta releases"
   git push origin main
   ```

3. **Announce on social media:**
   - Discord
   - Twitter/X
   - LinkedIn

---

## Notes

- Both releases are marked as **pre-release** (beta)
- Both releases point to the same branch: `release/v0.1.0-beta`
- Tags are already pushed to GitHub (v0.1.0-beta, v0.1.1-beta)
