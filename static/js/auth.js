$(document).ready(() => {
  const $burgerIcon = $(".burger__icon");
  const $burgerMenu = $(".burger__menu");

  $burgerIcon.click(() => {
    $burgerIcon.toggleClass("active");
    $burgerMenu.toggleClass("active");
  });

  $(document).click((e) => {
    if (
      !$(e.target).closest(".burger").length &&
      $burgerMenu.hasClass("active")
    ) {
      $burgerIcon.toggleClass("active");
      $burgerMenu.toggleClass("active");
    }
  });

  // let cookieBlock = `<div class='cookie_notification'>
  //   <p class='cookie_notification__text'>Мы используем Cookie на этом сайте</p>
  //   <button class='cookie_notification__accept'>Ладно</button></div>  `;
  // let wrapper = $(".wrapper");
  // let cookieDate = localStorage.getItem("cookieDate");

  // if (!cookieDate || +cookieDate + 31536000000 < Date.now()) {
  //   $(cookieBlock).appendTo(wrapper);
  // }

  // let cookieNotification = $(".cookie_notification");
  // $(".cookie_notification__accept").click(function () {
  //   localStorage.setItem("cookieDate", Date.now());
  //   cookieNotification.remove();
  // });
});
//---------------ЗАГРУЗКАДАННЫХ----------------

$("button").click(function () {
  const $button = $(this);

  if (
    !$button.hasClass("active-button") &&
    $button.hasClass("nonactive-button")
  ) {
    toggleActiveButton();
    if ($button.hasClass("button-timetable__right")) {
      showAnusual();
    } else {
      hideAnusual();
    }
  }

  function toggleActiveButton() {
    $(".active-button").toggleClass("active-button nonactive-button");
    $button.toggleClass("active-button nonactive-button");
  }

  function showAnusual() {
    $(".anusual").css("display", "block");
    setTimeout(() => {
      $(".anusual").toggleClass("active");
    }, 1);
  }

  function hideAnusual() {
    $(".anusual").toggleClass("active");
    setTimeout(() => {
      $(".anusual").css("display", "none");
    }, 200);
  }
});

const modals = window.modals = {
  login: `
        <div class="modal__background" data-modal="login">
            <div class="modal__active modal__active-login_form">
                <div class="modal__window">
                  <div class="modal__header">
                    <h2>Вход</h2>
                    <div class="modal__close">×</div>
                  </div>
                    <form id="loginForm">
                        <div class="form-group">
                            <label for="login">Логин</label>
                            <input type="text" name="login" id="login" placeholder="Логин">
                        </div>
                        <div class="form-group">
                            <label for="pass">Пароль</label>
                            <input type="password" name="pass" id="pass" placeholder="Пароль">
                        </div>
                        <button type="submit" class="btn-primary">Войти</button>
                        <p class="modal__forgot">
                          <a href="#" data-modal-open="forgot">Забыли пароль?</a>
                        </p>
                    </form>
                    <p class="modal__switch">Нет аккаунта? <a href="#" data-modal-open="reg">Зарегистрируйтесь!</a></p>
                </div>
            </div>
        </div>
    `,
  reg: `
        <div class="modal__background" data-modal="reg">
            <div class="modal__active modal__active-login_form">
                <div class="modal__window">
                  <div class="modal__header">
                    <h2>Регистрация</h2>
                    <div class="modal__close">×</div>
                  </div>
                    <form id="regForm">
                        <div class="form-group">
                            <label for="email">Почта</label>
                            <input type="email" name="email" id="email" placeholder="Почта">
                        </div>
                        <div class="form-group">
                            <label for="login">Логин</label>
                            <input type="text" name="login" id="login" placeholder="Логин">
                        </div>
                        <div class="form-group">
                            <label for="pass">Пароль</label>
                            <input type="password" name="pass" id="pass" placeholder="Пароль">
                        </div>
                        <button type="submit" class="btn-primary">Зарегистрироваться</button>
                    </form>
                    <p class="modal__switch">Уже с нами? <a href="#" data-modal-open="login">Войти</a></p>
                </div>
            </div>
        </div>
    `,
  commentThread: `
    <div class="modal__background" data-modal="commentThread">
      <div class="modal__active">
        <div class="modal__window comment-thread-modal">
          
          <div class="modal__header">
            <div class="modal__back-btn" style="display: none;">
              ← Назад
            </div>
            <h2>Ветка комментариев</h2>
            <div class="modal__close">×</div>
          </div>

          <div class="comment-thread-modal__body">
            <div class="comment-thread-parent-modal"></div>
            <div class="comment-thread-children"></div>
          </div>

        </div>
      </div>
    </div>
  `
};

function ucfirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

$(document).on("submit", "#loginForm", function (e) {
  e.preventDefault();
  let login = $("#login").val();
  let pass = $("#pass").val();
  console.log(login, pass);

  $("#login, #pass").removeClass("not-correct");

  $.ajax({
    type: "POST",
    url: "/users/login",
    data: { login: login, pass: pass },
    success: function (res) {
      if (res.error) {
        if (window.notifications) {
          window.notifications.error("Неверный логин или пароль");
        }
        $("#login").addClass("not-correct");
        $("#pass").addClass("not-correct");
      } else if (res.success) {
        window.location.href = `/`;
      }
    },
    error: function () {
      if (window.notifications) {
        window.notifications.error("Серверная ошибка");
      }
    },
  });
});

$(document).on("submit", "#regForm", function (e) {
  e.preventDefault();
  let email = $("#email").val();
  let login = $("#login").val();
  let pass = $("#pass").val();
  console.log(email, login, pass);

  $("#email, #login, #pass").removeClass("not-correct");

  $.ajax({
    type: "POST",
    url: "/users/register",
    data: {
      email: email,
      login: login,
      pass: pass,
    },
    success: function (res) {
      if (res.error) {
        if (res.error === "username_password_required") {
          if (window.notifications) {
            window.notifications.error("Логин и пароль обязательны");
          }
        }
        if (res.error === "emailErr") {
          if (window.notifications) {
            window.notifications.error(
              "Пользователь с таким email уже существует",
            );
          }
          $("#email").addClass("not-correct");
        }
        if (res.error === "userErr") {
          if (window.notifications) {
            window.notifications.success(
              "Пользователь с таким именем уже существует",
            );
          }
          $("#login").addClass("not-correct");
        }
      } else if (res.success) {
        window.location.href = `/`;
      }
    },
  });
});
