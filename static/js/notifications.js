// ===== NOTIFICATION SYSTEM =====
class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Создаем контейнер для уведомлений
    this.container = document.createElement("div");
    this.container.className = "notifications-container";
    this.container.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
    document.body.appendChild(this.container);
  }

  show(options) {
    const {
      title = "Уведомление",
      message,
      type = "info",
      duration = 5000,
      actions = [],
    } = options;

    const notification = document.createElement("div");
    notification.className = `notification notification--${type}`;

    notification.innerHTML = `
            <div class="notification__header">
                <h4 class="notification__title">${title}</h4>
                <button class="notification__close" type="button">×</button>
            </div>
            <p class="notification__message">${message}</p>
            ${
              actions.length > 0
                ? `
                <div class="notification__actions">
                    ${actions
                      .map(
                        (action) => `
                        <button class="notification__btn notification__btn--${action.type}" 
                                type="button" data-action="${action.key}">
                            ${action.label}
                        </button>
                    `,
                      )
                      .join("")}
                </div>
            `
                : ""
            }
        `;

    this.container.appendChild(notification);

    // Анимация появления
    setTimeout(() => notification.classList.add("show"), 10);

    // Обработчики событий
    const closeBtn = notification.querySelector(".notification__close");
    closeBtn.addEventListener("click", () => this.hide(notification));

    // Автоматическое скрытие
    if (duration > 0) {
      setTimeout(() => this.hide(notification), duration);
    }

    // Обработчики действий
    if (actions.length > 0) {
      actions.forEach((action) => {
        const btn = notification.querySelector(`[data-action="${action.key}"]`);
        btn.addEventListener("click", () => {
          if (action.callback) action.callback();
          this.hide(notification);
        });
      });
    }

    return notification;
  }

  hide(notification) {
    notification.classList.remove("show");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // Вспомогательные методы для частых сценариев
  success(message, duration = 3000) {
    return this.show({
      title: "Успешно!",
      message,
      type: "success",
      duration,
    });
  }

  error(message, duration = 5000) {
    return this.show({
      title: "Ошибка",
      message,
      type: "error",
      duration,
    });
  }

  warning(message, duration = 4000) {
    return this.show({
      title: "Внимание",
      message,
      type: "warning",
      duration,
    });
  }

  info(message, duration = 4000) {
    return this.show({
      title: "Информация",
      message,
      type: "info",
      duration,
    });
  }

  confirm(options) {
    return new Promise((resolve) => {
      this.show({
        title: options.title || "Подтверждение",
        message: options.message,
        type: "warning",
        duration: 0, // Не закрывать автоматически
        actions: [
          {
            key: "no",
            label: options.noText || "Нет",
            type: "secondary",
            callback: () => resolve(false),
          },
          {
            key: "yes",
            label: options.yesText || "Да",
            type: "primary",
            callback: () => resolve(true),
          },
        ],
      });
    });
  }
}

// Инициализируем глобально
window.notifications = new NotificationSystem();
