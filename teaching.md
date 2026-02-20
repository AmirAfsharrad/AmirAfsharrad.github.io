---
layout: page
title: Teaching
permalink: /teaching/
---

<img src="/assets/signature.png" alt="" style="position: fixed; bottom: 20px; right: 20px; width: 150px; opacity: 0.6; z-index: 1000; pointer-events: none;">

{% assign teaching = site.teaching | sort: "order" %}
{% for item in teaching %}
<div style="display: flex; align-items: flex-start; gap: 24px; margin-bottom: 40px;">
  <a href="{{ item.url | relative_url }}">
    <img src="{{ item.thumbnail }}" alt="{{ item.short_title }}" style="width: 140px; height: 100px; object-fit: cover; flex-shrink: 0;">
  </a>
  <div>
    <h3 style="margin: 0 0 4px 0;"><a href="{{ item.url | relative_url }}" style="text-decoration: none; color: inherit;">{{ item.short_title }}</a></h3>
    <p style="margin: 0 0 6px 0; color: #999; font-size: 0.85em;">{{ item.subtitle }} &nbsp;·&nbsp; {{ item.years }}</p>
    <p style="margin: 0;">{{ item.description }}</p>
  </div>
</div>
---
{% endfor %}
