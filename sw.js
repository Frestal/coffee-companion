// 咖啡伴侣 Service Worker
const CACHE_NAME = 'coffee-companion-v7';
const STATIC_ASSETS = [
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Noto+Serif+SC:wght@300;400;500&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap'
];

// 安装：只缓存静态资源，HTML 不预缓存
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting(); // 立即接管，不等待旧 SW 退出
});

// 激活：清理旧缓存，通知页面刷新
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Anthropic API：直接走网络，不缓存
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 主 HTML（根路径 / 或 coffee_v6.html）：Network First
  // 在线时永远拿最新版本，离线才用缓存
  const isMainHtml = url.pathname === '/'
    || url.pathname.endsWith('coffee_v6.html')
    || url.pathname.endsWith('index.html');

  if (isMainHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 拿到新版本后更新缓存
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // 离线时回落到缓存
          return caches.match(event.request)
            || caches.match('./coffee_v6.html');
        })
    );
    return;
  }

  // 其他静态资源（字体、manifest）：Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
