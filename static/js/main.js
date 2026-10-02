// ===== BURGER MENU =====
document.addEventListener("DOMContentLoaded", function () {
  const menuIcon = document.querySelector(".menu__icon");
  const menu = document.querySelector(".header__menu");
  const menuOverlay = document.getElementById("menu_overlay");
  const body = document.body;

  // Проверяем, что все элементы существуют :cite[2]:cite[3]
  if (!menuIcon || !menu || !menuOverlay) {
    console.error("One or more menu elements not found:", {
      menuIcon: !!menuIcon,
      menu: !!menu,
      menuOverlay: !!menuOverlay,
    });
    return;
  }

  // Функция открытия/закрытия меню
  function toggleMenu() {
    menuIcon.classList.toggle("active");
    menu.classList.toggle("active");
    menuOverlay.classList.toggle("active");
    body.classList.toggle("menu-open");

    console.log("Menu toggled. Active:", menu.classList.contains("active"));
  }

  // Обработчик клика по иконке меню
  menuIcon.addEventListener("click", function (e) {
    e.stopPropagation();
    e.preventDefault();
    console.log("Menu icon clicked");
    toggleMenu();
  });

  // Обработчик клика по оверлею (закрытие меню)
  menuOverlay.addEventListener("click", function (e) {
    e.stopPropagation();
    if (menu.classList.contains("active")) {
      console.log("Overlay clicked, closing menu");
      toggleMenu();
    }
  });

  // Закрытие меню при клике на ссылку
  const menuLinks = document.querySelectorAll(".menu__list a");
  menuLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      if (menu.classList.contains("active")) {
        console.log("Menu link clicked, closing menu");
        toggleMenu();
      }
    });
  });

  // Закрытие меню при изменении размера окна
  // (на случай перехода с мобильной на десктопную версию)
  window.addEventListener("resize", function () {
    if (window.innerWidth > 767 && menu.classList.contains("active")) {
      toggleMenu();
    }
  });
});

// ==== Theme Switcher ====
class ThemeSwitcher {
  constructor(toggleSelector = "#themeToggle") {
    this.el = document.querySelector(toggleSelector);
    this.themeKey = "theme";
    this._applySaved();
    this._bind();
  }

  _applySaved() {
    const current = localStorage.getItem(this.themeKey) || "light";
    if (current === "dark") document.body.classList.add("dark-theme");
    if (this.el) {
      if (document.body.classList.contains("dark-theme")) {
        this.el.textContent = "☀️";
      } else {
        this.el.textContent = "🌙";
      }
    }
  }

  _bind() {
    if (!this.el) return;
    this.el.addEventListener("click", () => this.toggle());
  }

  toggle() {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem(this.themeKey, isDark ? "dark" : "light");
    if (this.el) this.el.textContent = isDark ? "☀️" : "🌙";
  }
}
window.themeSwitcher = new ThemeSwitcher();

// ===== Глобальные утилиты =====
window.fcUtils = {
  // Первая буква заглавная
  ucfirst: (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
};

// ===== КЛИКАБЕЛЬНЫЕ КАРТОЧКИ ПОСТОВ =====
document.addEventListener("DOMContentLoaded", () => {
  const posts = document.querySelectorAll(".post");

  // Селекторы элементов, клик по которым не должен вызывать переход
  const interactiveSelectors = [
    ".post__author a", // ссылка автора
    ".tag", // теги
    ".button-like", // кнопка лайка
    ".button-dislike", // кнопка дизлайка
    ".filter-tag", // теги фильтров
    ".filters__reset", // сброс фильтров
    "select", // выпадающие списки
    "input", // радиокнопки и т.д.
    ".post__overlay-link", // если вдруг осталась (но мы её удалим)
  ];

  posts.forEach((post) => {
    post.addEventListener("click", (event) => {
      // Проверяем, был ли клик по интерактивному элементу или внутри него
      let isInteractive = false;
      for (let selector of interactiveSelectors) {
        if (event.target.closest(selector)) {
          isInteractive = true;
          break;
        }
      }

      // Если клик не по интерактивному элементу — переходим по ссылке
      if (!isInteractive) {
        const href = post.dataset.href;
        if (href && href !== "#") {
          window.location.href = href;
        }
      }
    });

    // Добавляем курсор pointer для всей карточки (опционально)
    post.style.cursor = "pointer";
  });
});
