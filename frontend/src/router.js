/** History API: одна HTML-страница, читаемые URL /posts/42 и /users/rimashi. */
export const routes = {
  home: '/',
  feed: '/posts',
  following: '/following',
  bookmarks: '/bookmarks',
  mine: '/my-posts',
  offline: '/offline',
  editor: '/editor',
  login: '/login',
  register: '/register',
  settings: '/settings',
  moderation: '/moderation',
};

export function resolve(pathname) {
  const pathnameOnly = String(pathname || '/').split(/[?#]/)[0];
  const path = pathnameOnly.replace(/\/+$/, '') || '/';

  if (path === '/') return { page: 'home' };
  const known = Object.entries(routes).find(([, url]) => url === path);
  if (known) return { page: known[0] };

  const article = path.match(/^\/posts\/(\d+)$/);
  if (article) return { page: 'article', id: article[1] };

  const author = path.match(/^\/users\/([^/]+)$/);
  if (author) return { page: 'profile', name: decodeURIComponent(author[1]) };

  return { page: 'notfound' };
}

let routeChanged = () => {};

export function startRouter(callback) {
  routeChanged = callback;
  window.addEventListener('popstate', () => routeChanged(resolve(location.pathname)));

  // Переход со старых ссылок вида #post/42 и #profile/maxim.
  const legacy = location.hash.slice(1);
  let newPath = null;
  if (legacy.startsWith('post/')) newPath = '/posts/' + legacy.slice(5);
  else if (legacy.startsWith('profile/')) newPath = '/users/' + encodeURIComponent(legacy.slice(8));
  else if (routes[legacy]) newPath = routes[legacy];
  if (newPath) history.replaceState(null, '', newPath);

  routeChanged(resolve(location.pathname));
}

export function navigate(path, { replace = false } = {}) {
  if (!path.startsWith('/')) throw new Error('Внутренний маршрут должен начинаться с /.');

  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);

  routeChanged(resolve(location.pathname));
  window.scrollTo(0, 0);
}
