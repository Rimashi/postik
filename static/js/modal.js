$(function () {
  let modalStack = [];
  let modalDepth = 0; // Отслеживаем глубину открытых модалей комментариев

  function getActiveModal() {
    return $(".modal__background.active");
  }

  window.openModal = function (name, data = null) {
    if (!window.modals || !modals[name]) {
      console.error("Modal not found:", name);
      return;
    }

    const $current = getActiveModal();
    if ($current.length) {
      modalStack.push({
        name: $current.data("modal"),
        id: $current.data("modal-id") || null,
        depth: $current.data("modal-depth") || 0,
        html: $current.prop("outerHTML"),
      });
      $current.remove();
    }

    const $modal = $(modals[name]).appendTo("body");

    if (data?.id) {
      $modal.attr("data-modal-id", data.id);
    }

    // Увеличиваем глубину для commentThread модалей
    if (name === "commentThread") {
      modalDepth++;
      $modal.attr("data-modal-depth", modalDepth);
      
      // Показываем кнопку "назад" если это не первая модаль
      if (modalDepth > 0 && modalStack.length > 0) {
        const $backBtn = $modal.find(".modal__back-btn");
        if ($backBtn.length) {
          $backBtn.show();
          $backBtn.off("click").on("click", function (e) {
            e.preventDefault();
            closeModal();
          });
        }
      }
    }

    $("body").addClass("modal-open");
    $modal.addClass("active");

    $modal.find(".modal__close").on("click", closeModal);

    $modal.on("click", function (e) {
      if (e.target === this) closeModal();
    });

    $(document)
      .off("keydown.modal")
      .on("keydown.modal", function (e) {
        if (e.key === "Escape") closeModal();
      });
  };

  function closeModal() {
    const $active = getActiveModal();
    const activeName = $active.data("modal");

    if ($active.length) {
      $active.remove();
    }

    // Уменьшаем глубину если это была commentThread модаль
    if (activeName === "commentThread" && modalDepth > 0) {
      modalDepth--;
    }

    const prev = modalStack.pop();

    if (prev) {
      const $modal = $(prev.html).appendTo("body");
      $("body").addClass("modal-open");
      $modal.addClass("active");
      
      // Восстанавливаем глубину
      modalDepth = prev.depth || 0;
      
      // Если это модаль с комментариями, переинициализируем события
      if (prev.name === "commentThread" && window.commentsTree) {
        setTimeout(() => {
          window.commentsTree.attachThreadModalEvents();
        }, 50);
      }
    } else {
      $("body").removeClass("modal-open");
      modalDepth = 0;
    }

    $(document).off("keydown.modal");
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  $(document).on("click", "[data-modal-open]", function (e) {
    e.preventDefault();
    openModal($(this).data("modal-open"));
  });

  $(document).on("click", "[data-modal-close]", function (e) {
    e.preventDefault();
    closeModal();
  });

  window.closeModal = closeModal;
});