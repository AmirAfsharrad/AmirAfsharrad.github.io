---
layout: page
title: "Projects"
permalink: /projects/
---

<style>
  .project-list {
    display: grid;
    gap: 18px;
    margin-top: 24px;
  }

  .project-card {
    border: 1px solid #e5e5e5;
    padding: 18px;
    background: #fff;
  }

  .project-card h2 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
  }

  .project-card p {
    margin: 0 0 14px 0;
  }

  .project-meta {
    color: #666;
    font-size: 0.9rem;
  }
</style>

This is where I keep small tools, experiments, and personal projects that are useful enough to share.

<div class="project-list">
  <article class="project-card">
    <h2><a href="{{ '/projects/math/' | relative_url }}">Math Simulations</a></h2>
    <p>Interactive visualizations for the linear-algebra ideas behind my EE263 course: matrix transformations, linearization, and more.</p>
    <div class="project-meta">For students and the curious.</div>
  </article>

  <article class="project-card">
    <h2><a href="{{ '/projects/lexeme/' | relative_url }}">Lexeme</a></h2>
    <p>A private workspace for storing expressions, practicing both directions, and tracking review history.</p>
    <div class="project-meta">Hidden beta.</div>
  </article>
</div>
