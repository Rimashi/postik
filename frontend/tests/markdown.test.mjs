import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownToHtml,safeUrl} from '../src/shared/markdown.js';
test('Markdown: заголовки, списки, цитаты',()=>{
 const html=markdownToHtml('## Заголовок\n\n- пункт\n\n> цитата\n');
 assert.match(html,/<h2>Заголовок<\/h2>/);
 assert.match(html,/<li>пункт<\/li>/);
 assert.match(html,/<blockquote>цитата<\/blockquote>/);
});
test('Markdown: сырой HTML экранируется',()=>{
 const html=markdownToHtml('<img src=x onerror=alert(1)>');
 assert.doesNotMatch(html,/<img\s/);
 assert.match(html,/&lt;img/);
 assert.equal(safeUrl('javascript:alert(1)'),'#');
});
