---
layout: page
title: Blog
permalink: /blog/
---

<img src="/assets/signature.png" alt="" style="position: fixed; bottom: 20px; right: 20px; width: 150px; opacity: 0.6; z-index: 1000; pointer-events: none;">

{% for post in site.posts %}
### [{{ post.title }}]({{ post.url | relative_url }})
<span style="color: #999; font-size: 0.85em;">{{ post.date | date: "%B %-d, %Y" }} &nbsp;·&nbsp; 15-minute read</span>

{% if post.description %}*{{ post.description }}*{% endif %}

[Read more →]({{ post.url | relative_url }})

---
{% endfor %}
