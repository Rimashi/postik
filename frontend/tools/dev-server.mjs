// Резервный сервер, если Vite ещё не установлен. Поддерживает SPA-маршруты.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.md':'text/markdown'};
const port=Number(process.env.PORT||5173);
http.createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  // Резервный dev-сервер повторяет Vite proxy для /api, не требует npm install.
  if (pathname.startsWith('/api/')) {
    const backend=http.request({hostname:'127.0.0.1',port:8000,method:req.method,path:req.url,
      headers:{...req.headers,host:'127.0.0.1:8000'}},response=>{
      res.writeHead(response.statusCode||502,response.headers);response.pipe(res);
    });
    backend.on('error',()=>res.writeHead(502).end('FastAPI is not running'));
    req.pipe(backend);
    return;
  }
  let file=path.resolve(root, '.'+pathname);
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end('Forbidden');return;}
  if(pathname.startsWith('/assets/'))file=path.join(root,'public',pathname);
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);}
  catch{if(path.extname(pathname)&&pathname!=='/'){res.writeHead(404).end('Not found');return;}
    const data=await readFile(path.join(root,'index.html'));res.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'}).end(data);}
}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));
