---
layout: page
title: Blog
permalink: /blog/
---

# Blog

Welcome to my blog! Here I occasionally write about research ideas, technical topics, and thoughts on machine learning, optimization, and control.

---

{% for post in site.posts %}
  <article>
    <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
    <p class="post-meta">{{ post.date | date: "%B %-d, %Y" }}</p>
    {{ post.excerpt }}
    <a href="{{ post.url | relative_url }}">Read more →</a>
  </article>
  <hr>
{% endfor %}

---

*More posts coming soon!*
