#!/bin/bash

# Simple local testing script for your Jekyll site
# Run this with: bash test-local.sh

echo "Starting local Jekyll server..."
echo "Your site will be available at: http://localhost:4000"
echo "Press Ctrl+C to stop the server"
echo ""

# Try to serve with Jekyll (if available)
if command -v jekyll &> /dev/null; then
    jekyll serve --livereload
elif command -v bundle &> /dev/null; then
    bundle exec jekyll serve --livereload
else
    echo "Jekyll not installed. Installing dependencies..."
    echo "This requires Ruby. If you don't have it, just test by pushing to GitHub."
    echo ""
    echo "For now, just push to GitHub to test (it rebuilds in 1-2 minutes)"
fi
