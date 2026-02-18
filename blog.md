---
layout: page
title: Blog
permalink: /blog/
---

<img src="/assets/signature.png" alt="" style="position: fixed; bottom: 20px; right: 20px; width: 150px; opacity: 0.6; z-index: 1000; pointer-events: none;">

{% for post in site.posts %}
### [{{ post.title }}]({{ post.url | relative_url }})
*{{ post.date | date: "%B %-d, %Y" }}*

{{ post.excerpt }}

[Read more →]({{ post.url | relative_url }})

---
{% endfor %}
