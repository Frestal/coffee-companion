// 咖啡伴侣 Service Worker
const CACHE_NAME = 'coffee-companion-v7';
const OFFLINE_URLS = [
  './coffee_v6.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Noto+Serif+SC:wght@300;400;500&family=DM+Mono:ital,wght@0,300;0,400;1,300&display=swap'
];

// 安装：缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching core assets');
      return cache.addAll(OFFLINE_URLS).catch(err => {
        // 字体可能跨域失败，忽略
        console.log('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求拦截：Cache First 策略（本地资源），Network First（API）
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Anthropic API 请求：直接走网络，不缓存
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 本地资源：Cache First
  if (url.hostname === self.location.hostname || url.protocol === 'file:') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => caches.match('./coffee_v6.html'));
      })
    );
    return;
  }

  // 其他请求（字体等）：Cache First with Network Fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
