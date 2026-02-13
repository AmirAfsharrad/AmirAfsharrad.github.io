# Local Testing Guide

## Quick Method (Recommended for quick checks)

The easiest way to test locally without Jekyll is to just open the files in your browser, but this won't render the full Jekyll site.

**For full testing, you have two options:**

## Option 1: Use a Testing Branch (Easiest!)

Instead of pushing to main, create a test branch:

```bash
# Create and switch to a test branch
git checkout -b test-changes

# Make your changes, then commit
git add -A
git commit -m "Testing something"

# Push to the test branch
git push origin test-changes

# Check your site at the normal URL - it will show main branch
# When satisfied, merge to main:
git checkout main
git merge test-changes
git push origin main
```

## Option 2: Run Jekyll Locally (More Complex)

### Requirements:
- Ruby installed on your Mac
- Bundler gem

### Steps:

1. Install dependencies (first time only):
```bash
bundle install
```

2. Run local server:
```bash
bundle exec jekyll serve --livereload
```

3. Open browser to: `http://localhost:4000`

4. The site will auto-reload when you save changes!

---

**For most quick tests, I recommend Option 1 (test branch) - it's simpler and doesn't require Ruby setup!**
