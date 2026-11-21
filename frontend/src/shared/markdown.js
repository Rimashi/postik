import { esc } from './html.js';
export const safeUrl = value => { const v = String(value || '').trim(); return /^(https?:\/\/|mailto:|\/assets\/|data:image\/(png|jpeg|webp);base64,)/i.test(v) ? v : '#'; };
function inline(v) { let t = esc(v); t = t.replace(/`([^`]+)`/g, '<code>$1</code>'); t = t.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_, alt, url) => `<img src="${esc(safeUrl(url))}" alt="${alt}" loading="lazy">`); t = t.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`); t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>'); return t; }
export function markdownToHtml(markdown) { const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n'); let html = '', list = false, code = false, buffer = []; const flush = () => { if (buffer.length) {
    html += `<p>${buffer.map(inline).join('<br>')}</p>`;
    buffer = [];
} }; for (const line of lines) {
    if (/^```/.test(line)) {
        flush();
        if (list) {
            html += '</ul>';
            list = false;
        }
        html += code ? '</code></pre>' : '<pre><code>';
        code = !code;
        continue;
    }
    if (code) {
        html += esc(line) + '\n';
        continue;
    }
    if (!line.trim()) {
        flush();
        if (list) {
            html += '</ul>';
            list = false;
        }
        continue;
    }
    let match;
    if ((match = /^(#{1,4})\s+(.+)$/.exec(line))) {
        flush();
        if (list) {
            html += '</ul>';
            list = false;
        }
        const level = match[1].length;
        html += `<h${level}>${inline(match[2])}</h${level}>`;
        continue;
    }
    if (/^>\s?/.test(line)) {
        flush();
        html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`;
        continue;
    }
    if ((match = /^\s*[-*]\s+(.+)/.exec(line))) {
        flush();
        if (!list) {
            html += '<ul>';
            list = true;
        }
        html += `<li>${inline(match[1])}</li>`;
        continue;
    }
    if (list) {
        html += '</ul>';
        list = false;
    }
    buffer.push(line.trim());
} flush(); if (list)
    html += '</ul>'; if (code)
    html += '</code></pre>'; return html; }
