document.addEventListener("DOMContentLoaded", () => {
  // ELEMENTS
  const postIdInput = document.getElementById("postId");

  const titleInput = document.getElementById("title");
  const categorySelect = document.getElementById("category");
  const tagsInput = document.getElementById("tags");
  const excerptInput = document.getElementById("excerpt");
  const coverUrlInput = document.getElementById("coverUrl");
  const coverPreview = document.getElementById("coverPreview");
  const coverPreviewImg = document.getElementById("coverPreviewImg");
  const previewPane = document.getElementById("previewPane");
  const previewMobileContent = document.getElementById("previewMobileContent");

  const previewModal = document.getElementById("previewModal");
  const btnMobilePreview = document.getElementById("btnMobilePreview");
  const btnLoadMd = document.getElementById("btnLoadMd");
  const fileMdInput = document.getElementById("fileMdInput");
  const btnUploadCover = document.getElementById("btnUploadCover");
  const fileCover = document.getElementById("fileCover");
  const btnDraft = document.getElementById("btnDraft");
  const btnPublish = document.getElementById("btnPublish");
  const btnDelete = document.getElementById("btnDelete");

  const tagsList = document.getElementById("tagsList");

  // MARKED
  marked.setOptions({
    breaks: true,
    gfm: true,

    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, {
          language: lang,
        }).value;
      }

      return escapeHtml(code);
    },
  });

  // EASYMDE
  const easyMDE = new EasyMDE({
    element: document.getElementById("markdown-editor"),

    spellChecker: false,
    autofocus: false,
    status: false,

    imageUpload: true,
    imageAccept: "image/png, image/jpeg, image/webp, image/gif",
    imageUploadEndpoint: "/posts/api/upload-image",

    placeholder: "Напишите вашу статью...",

    renderingConfig: {
      singleLineBreaks: false,
      codeSyntaxHighlighting: true,
    },

    toolbar: [
      "bold",
      "italic",
      "heading",
      "|",
      "quote",
      "unordered-list",
      "ordered-list",
      "|",
      "link",
      "image",
      "table",
      "code",
      "|",
      "preview",
      "side-by-side",
      "fullscreen",
    ],
  });

  // =========================
  // HELPERS
  // =========================

  function escapeHtml(str) {
    if (!str) return "";

    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function calculateReadingTime(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;

    return Math.max(1, Math.ceil(words / 180));
  }

  function getTagsArray() {
    return tagsInput.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);

    return params.get("id");
  }

  // =========================
  // COVER
  // =========================

  function updateCoverPreview() {
    const url = coverUrlInput.value.trim();

    if (!url) {
      coverPreview.style.display = "none";
      return;
    }

    coverPreview.style.display = "block";
    coverPreviewImg.src = url;
  }

  coverUrlInput.addEventListener("input", () => {
    updateCoverPreview();
    renderPreview();
  });

  // =========================
  // UPLOAD COVER
  // =========================

  btnUploadCover.addEventListener("click", () => {
    fileCover.click();
  });

  fileCover.addEventListener("change", async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/posts/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Ошибка загрузки");
        return;
      }

      const imageUrl = data.data.filePath;
      coverUrlInput.value = imageUrl;
      updateCoverPreview();
      renderPreview();
    } catch (error) {
      console.error(error);
      alert("Ошибка загрузки файла");
    }
  });

  // =========================
  // LOAD MD
  // =========================

  btnLoadMd.addEventListener("click", () => {
    fileMdInput.click();
  });

  fileMdInput.addEventListener("change", (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      easyMDE.value(event.target.result);

      renderPreview();
    };

    reader.readAsText(file);
  });

  // =========================
  // PREVIEW
  // =========================

  function buildPreviewHtml() {
    const title = titleInput.value.trim() || "Название статьи";

    const markdown = easyMDE.value();

    const excerpt =
      excerptInput.value.trim() || markdown.slice(0, 180).replaceAll("#", "");

    const html = marked.parse(markdown);

    const tags = getTagsArray();

    const cover = coverUrlInput.value.trim();

    const readingTime = calculateReadingTime(markdown);

    const tagsHtml = tags
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join("");

    return `
      <div class="editor-preview-wrapper">

        <article class="post">

          <div class="post__header">

            <div class="post__upload_section">
              <div class="post__author">
                <a href="#" class="author__link">
                  ${window.currentUsername || "you"}
                </a>
              </div>

              <div class="post__time">
                <p class="time__upload">
                  Только что
                </p>
              </div>
            </div>

            <div class="post__name">
              <h3 class="post__title">
                ${escapeHtml(title)}
              </h3>
            </div>

            <div class="post__meta_section">

              <div class="meta_section__upside">

                <div class="post__time_to_read">
                  <p class="read_time">
                    ${readingTime} мин
                  </p>
                </div>

                <div class="post__views">
                  <p class="views">0 просмотров</p>
                </div>

              </div>

              ${
                tags.length
                  ? `
                <div class="meta_section__downside">
                  <div class="tags">
                    ${tagsHtml}
                  </div>
                </div>
              `
                  : ""
              }

            </div>
          </div>

          <div class="post__body">

            ${
              cover
                ? `
              <div class="post__image">
                <img src="${cover}" alt="cover">
              </div>
            `
                : ""
            }

            <div class="post__description">
              <p>${escapeHtml(excerpt)}</p>
            </div>

          </div>

        </article>

        <div class="editor-preview-divider">
          Полная статья
        </div>

        <article class="preview-article">
          <div class="preview-content">
            ${html}
          </div>
        </article>

      </div>
    `;
  }

  function renderPreview() {
    const html = buildPreviewHtml();

    if (previewPane) {
      previewPane.innerHTML = html;
    }

    if (previewMobileContent) {
      previewMobileContent.innerHTML = html;
    }

    document.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  // =========================
  // API
  // =========================

  async function loadCategories() {
    try {
      const response = await fetch("/posts/api/categories");

      const categories = await response.json();

      categorySelect.innerHTML = '<option value="">-- выберите --</option>';

      categories.forEach((category) => {
        const option = document.createElement("option");

        option.value = category.id;
        option.textContent = category.name;

        categorySelect.appendChild(option);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function loadTagsSuggestions(query = "") {
    try {
      const response = await fetch(
        `/posts/api/tags?q=${encodeURIComponent(query)}`,
      );

      const tags = await response.json();

      tagsList.innerHTML = "";

      tags.forEach((tag) => {
        const option = document.createElement("option");

        option.value = tag;

        tagsList.appendChild(option);
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function savePost(status = "draft") {
    try {
      const payload = {
        id: postIdInput.value || null,

        title: titleInput.value,

        category_id: categorySelect.value,

        tags: tagsInput.value,

        excerpt: excerptInput.value,

        cover_image: coverUrlInput.value,

        content_md: easyMDE.value(),

        status,
      };

      const response = await fetch("/posts/api/posts", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ошибка сохранения");
      }

      alert("Статья сохранена");

      if (result.post?.id) {
        postIdInput.value = result.post.id;

        btnDelete.style.display = "inline-flex";
      }
    } catch (err) {
      console.error(err);

      alert(err.message);
    }
  }

  async function loadPost(postId) {
    try {
      const response = await fetch(`/posts/api/posts/${postId}`);

      const post = await response.json();

      titleInput.value = post.title || "";

      excerptInput.value = post.excerpt || "";

      coverUrlInput.value = post.cover_image || "";

      tagsInput.value = (post.tags || []).join(", ");

      easyMDE.value(post.content_md || "");

      postIdInput.value = post.id;

      updateCoverPreview();

      renderPreview();

      btnDelete.style.display = "inline-flex";
    } catch (err) {
      console.error(err);
    }
  }

  async function deletePost() {
    const postId = postIdInput.value;

    if (!postId) return;

    const confirmed = confirm("Удалить статью?");

    if (!confirmed) return;

    try {
      const response = await fetch(`/posts/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка удаления");
      }

      window.location.href = "/posts/my";
    } catch (err) {
      console.error(err);

      alert(err.message);
    }
  }

  // =========================
  // EVENTS
  // =========================

  titleInput.addEventListener("input", renderPreview);

  categorySelect.addEventListener("change", renderPreview);

  tagsInput.addEventListener("input", () => {
    loadTagsSuggestions(tagsInput.value);

    renderPreview();
  });

  excerptInput.addEventListener("input", renderPreview);

  easyMDE.codemirror.on("change", renderPreview);

  btnDraft.addEventListener("click", () => {
    savePost("draft");
  });

  btnPublish.addEventListener("click", () => {
    savePost("published");
  });

  btnDelete.addEventListener("click", deletePost);

  // =========================
  // MOBILE PREVIEW
  // =========================

  if (btnMobilePreview) {
    btnMobilePreview.addEventListener("click", () => {
      previewModal.classList.add("active");
    });
  }

  const closeBtn = previewModal.querySelector(".modal__close");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      previewModal.classList.remove("active");
    });
  }

  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) {
      previewModal.classList.remove("active");
    }
  });

  // =========================
  // INIT
  // =========================

  async function init() {
    await loadCategories();

    await loadTagsSuggestions();

    const postId = getPostIdFromUrl();

    if (postId) {
      await loadPost(postId);
    }

    updateCoverPreview();

    renderPreview();
  }

  init();
});
