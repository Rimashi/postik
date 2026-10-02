document.addEventListener("DOMContentLoaded", () => {
  const postsGrid = document.getElementById("postsGrid");
  if (!postsGrid) return;

  fetch("/posts/api/feed?sort=recent&period=all")
    .then((response) => {
      if (!response.ok) throw new Error("feed request failed");
      return response.json();
    })
    .then((posts) => {
      renderPosts(posts.slice(0, 6));
    })
    .catch(() => {
      postsGrid.innerHTML = '<p class="no-articles">Не удалось загрузить статьи.</p>';
    });

  function renderPosts(posts) {
    if (!posts.length) {
      postsGrid.innerHTML = '<p class="no-articles">Пока нет опубликованных статей.</p>';
      return;
    }

    postsGrid.innerHTML = posts
      .map((post) => {
        const tags = (post.tags || [])
          .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
          .join("");

        return `
          <article class="post-card" data-href="/posts/${post.id}">
            <div class="post-card__content">
              <h3 class="post-card__title">${escapeHtml(post.title)}</h3>
              <div class="post-card__meta">
                <span class="post-card__author">${escapeHtml(post.author)}</span>
                <span class="post-card__date">${formatDate(post.published_at)}</span>
              </div>
              <div class="post-card__tags">${tags}</div>
              <div class="post-card__excerpt">${escapeHtml(post.excerpt || "")}</div>
              <a href="/posts/${post.id}" class="post-card__link">Читать →</a>
            </div>
          </article>`;
      })
      .join("");

    document.querySelectorAll(".post-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (!event.target.closest("a")) {
          window.location.href = card.dataset.href;
        }
      });
    });
  }

  function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("ru-RU");
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
  }
});
