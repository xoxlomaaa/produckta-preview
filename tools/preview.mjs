import {createServer} from 'node:http';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PREVIEW_PORT||4330);
const mime={
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.png':'image/png',
  '.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf',
  '.glb':'model/gltf-binary','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8',
};
createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method))return res.writeHead(405,{Allow:'GET, HEAD'}).end();
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__frontend-health')return res.writeHead(200,{'Content-Type':'application/json'})
      .end(JSON.stringify({project:'Produckta',root,port,pid:process.pid}));
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(resolve(root)+sep)||!mime[extname(file)])return res.writeHead(404).end('Not found');
    const info=await stat(file);
    if(!info.isFile())return res.writeHead(404).end('Not found');
    res.writeHead(200,{
      'Content-Type':mime[extname(file)],'Content-Length':info.size,
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',
    });
    if(req.method==='HEAD')return res.end();
    if(res.destroyed)return;
    const stream=createReadStream(file);
    res.on('close',()=>stream.destroy());
    stream.on('error',()=>res.destroy());
    stream.pipe(res);
  }catch(error){
    res.writeHead(error.code==='ENOENT'||error.code==='ENOTDIR'?404:error instanceof URIError?400:500).end('Not found');
  }
}).listen(port,'127.0.0.1',()=>console.log(`Produckta preview: http://127.0.0.1:${port}/`));
