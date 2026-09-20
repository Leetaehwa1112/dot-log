/**
 * 설치한 뒤에는 인터넷이 없어도 떠야 한다.
 *
 * 앱 껍데기(문서·카탈로그·아이콘)는 설치할 때 받아 두고, 그다음부터는 캐시에서 먼저 준다.
 * 새 판이 올라오면 skipWaiting()+clients.claim() 으로 바로 갈아끼운다.
 * 옛 껍데기를 붙들고 있으면 고친 것이 사용자에게 도달을 안 한다 —
 * 실제로 v1 을 안 올려서 배포가 한 번 헛돌았다.
 * 단 문서는 cache-first 라, 화면에 반영되는 건 다음 번 열 때다.
 */
const V = "dotlog-v4";   // 올릴 때마다 바꾼다 — 안 바꾸면 설치된 기기가 옛 index.html 을 계속 쓴다
const SHELL = ["./", "./index.html", "./products-catalog.js", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 동기화 요청은 절대 캐시하지 않는다 — 옛 기록을 돌려주면 안 된다
  if (new URL(req.url).hostname.endsWith("workers.dev")) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(V).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;     // 있으면 즉시, 없으면 받아서
    }),
  );
});
