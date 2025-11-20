# Create Pull Request Commands

## Option 1: GitHub CLI (gh)

### Create PR from Beta Branch to Main

```bash
# Make sure you're on the beta branch
git checkout release/v0.1.0-beta

# Create PR
gh pr create \
  --title "🎉 TypeScript Beta Release: Merge v0.1.0-beta → main" \
  --body-file PULL_REQUEST_BETA_TO_MAIN.md \
  --base main \
  --head release/v0.1.0-beta \
  --label "breaking-change" \
  --label "beta" \
  --label "needs-discussion"
```

---

## Option 2: GitHub Web UI

1. **Go to PR creation page:**

   ```
   https://github.com/onoal/Nucleus/compare/main...release/v0.1.0-beta
   ```

2. **Fill in details:**
   - Title: `🎉 TypeScript Beta Release: Merge v0.1.0-beta → main`
   - Base: `main`
   - Compare: `release/v0.1.0-beta`
   - Description: Copy content from `PULL_REQUEST_BETA_TO_MAIN.md`

3. **Add labels:**
   - `breaking-change`
   - `beta`
   - `needs-discussion`

4. **Click "Create Pull Request"**

5. **Do NOT merge yet!** This needs discussion first.

---

## Option 3: Keep Branches Separate (No PR)

If you decide **NOT** to merge to main (keep TypeScript on beta branch):

### Update Main README to Reference Beta

```bash
git checkout main
```

Add to `README.md`:

```markdown
## 🚀 TypeScript Beta Available!

A TypeScript-first implementation is available as beta:

- **Branch:** `release/v0.1.0-beta`
- **npm:** `npm install @onoal/nucleus@beta`
- **Docs:** [Beta Documentation](https://github.com/onoal/Nucleus/tree/release/v0.1.0-beta)
```

```bash
git add README.md
git commit -m "docs: add link to TypeScript beta"
git push origin main
```

---

## Important Considerations

### Before Creating PR

**⚠️ This PR represents a MAJOR architectural change:**

1. **Complete rewrite** (Rust → TypeScript)
2. **Different file structure**
3. **Will cause massive merge conflicts**
4. **Removes existing Rust implementation**

### Questions to Answer First

1. **Do we want to merge TypeScript to main?**
   - Yes → TypeScript becomes the official implementation
   - No → Keep Rust on main, TypeScript on beta branch

2. **What happens to the Rust code?**
   - Archive it?
   - Move to separate branch?
   - Create `nucleus-rust` repo?

3. **Is this a new major version?**
   - Should this be `v2.0.0` instead of `v0.1.x`?
   - Separate package name? (`@onoal/nucleus-ts`?)

---

## Recommended Approach

### Phase 1: Create PR for Discussion (Do NOT Merge)

```bash
gh pr create \
  --title "🎉 [Discussion] TypeScript Beta: Should we merge to main?" \
  --body-file PULL_REQUEST_BETA_TO_MAIN.md \
  --base main \
  --head release/v0.1.0-beta \
  --label "needs-discussion" \
  --draft  # Mark as draft
```

### Phase 2: Gather Feedback

Let the team discuss:

- Architecture direction
- Rust vs TypeScript
- Separate packages?
- Version numbering

### Phase 3: Decide & Execute

Based on discussion, choose:

- **A.** Merge to main (TypeScript is official)
- **B.** Keep separate (parallel implementations)
- **C.** New repo (`nucleus-ts`)

---

## Quick Links

- **Compare View:** https://github.com/onoal/Nucleus/compare/main...release/v0.1.0-beta
- **Releases:** https://github.com/onoal/Nucleus/releases
- **Issues:** https://github.com/onoal/Nucleus/issues
- **Discussions:** https://github.com/onoal/Nucleus/discussions

---

## Summary

**My Recommendation:**

1. Create **Draft PR** with `PULL_REQUEST_BETA_TO_MAIN.md` as description
2. **Do NOT merge** yet - get team feedback first
3. Keep beta branch as official TypeScript implementation for now
4. Update main README to point to beta branch

This allows users to try the beta while the team decides on the long-term strategy.

---

**Ready to create the PR?** Run the command above! 🚀
