---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
---

<div>
  {% for post in site.posts %}
      <h1><a href="{{ post.url }}">{{ post.title }}</a></h1>
      {{ post.excerpt }}
      <a class="button" href="{{post.url }}">more...</a>
  {% endfor %}
</div>
