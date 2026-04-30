(() => {
  const filters = document.getElementById('tag-filters');
  const list = document.getElementById('post-list');
  if (!filters || !list) return;

  const cards = list.querySelectorAll('.blog-card');
  const yearGroups = list.querySelectorAll('.year-group');

  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;

    const tag = btn.dataset.tag;
    filters.querySelectorAll('.tag-btn').forEach(b => b.classList.toggle('tag-btn--active', b === btn));

    cards.forEach(card => {
      const tags = (card.dataset.tags || '').split(',').filter(Boolean);
      const match = tag === '*' || tags.includes(tag);
      card.classList.toggle('is-hidden', !match);
    });

    // Hide year groups that have no visible cards
    yearGroups.forEach(group => {
      const visible = group.querySelectorAll('.blog-card:not(.is-hidden)').length;
      group.classList.toggle('is-hidden', visible === 0);
    });
  });
})();
