import { launch } from './app.js';
import { hydrate } from './store.js';
// Сначала загружаем сессию/темы/посты; затем запускаем навигацию,
// чтобы прямой URL /posts/:id работал после перезагрузки страницы.
await hydrate();
launch();
