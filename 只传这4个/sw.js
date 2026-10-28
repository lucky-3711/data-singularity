/* 黑洞 · offline shell
   策略：
   - 导航请求（打开页面）→ 网络优先，离线回落缓存：改完 push 立刻可见，不用手动改版本号
   - 静态资源 → 缓存优先 + 后台静默更新（stale-while-revalidate）：首屏快，且下次打开是新版
*/
const CACHE = 'blackhole-v2';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './soul.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
];

/* 预缓存：单个文件失败不能拖垮整个 install（原 addAll 会整体 reject，SW 永远装不上） */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (!res || res.status !== 200 || res.type !== 'basic') return res;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  /* 页面导航：网络优先 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  /* 其余静态资源：缓存优先 + 后台更新 */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => putInCache(req, res));
      return hit || net.catch(() => hit);
    })
  );
});
