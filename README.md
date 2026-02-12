# Amirhossein Afsharrad - Personal Website

This is the source code for my personal academic website, hosted at [https://amirafsharrad.github.io](https://amirafsharrad.github.io).

## Site Structure

- `index.md` - Home page with bio and news
- `research.md` - Research interests and publications
- `teaching.md` - Teaching experience
- `blog.md` - Blog posts listing
- `_posts/` - Individual blog posts
- `_config.yml` - Site configuration

## How to Update

### Adding a Blog Post

1. Create a new file in `_posts/` with the format: `YYYY-MM-DD-title.md`
2. Add front matter at the top:
```yaml
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD
categories: [category1, category2]
---
```
3. Write your content in Markdown below the front matter
4. Commit and push to GitHub

### Updating Publications

Edit the `research.md` file and add your new publication in the appropriate year section.

### Updating Personal Info

Edit `_config.yml` for site-wide settings or `index.md` for your bio.

## Local Development

To test the site locally:

```bash
bundle install
bundle exec jekyll serve
```

Then visit `http://localhost:4000` in your browser.

## Publishing

Simply commit and push to the `main` branch - GitHub Pages will automatically build and deploy your site within a few minutes.

## Built With

- [Jekyll](https://jekyllrb.com/) - Static site generator
- [GitHub Pages](https://pages.github.com/) - Hosting
- [Minima](https://github.com/jekyll/minima) - Jekyll theme
