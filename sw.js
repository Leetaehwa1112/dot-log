/**
 * 설치한 뒤에는 인터넷이 없어도 떠야 한다. 그런데 그것 때문에
 * 고친 것이 사용자에게 안 가면 곤란하다. 둘을 나눠서 잡는다.
 *
 *  · 문서(index.html) — 네트워크 먼저. 고친 것이 그 자리에서 보여야 한다.
 *    예전에는 캐시 먼저였는데, 그러면 설치한 앱은 늘 한 번 늦게 반영됐다.
 *    대신 3초 안에 응답이 없거나 인터넷이 없으면 캐시로 넘어간다 —
 *    지하철에서 앱이 안 뜨는 것보다는 조금 옛 화면이 낫다.
 *
 *  · 나머지(카탈로그·사진·아이콘·여는화면) — 캐시 먼저.
 *    내용이 바뀌지 않는 것들이라 매번 물어볼 이유가 없고, 뒤에서 갱신해 둔다.
 *
 * 동기화 요청은 어느 쪽도 아니다. 손대지 않고 그냥 지나보낸다.
 */
const V = "dotlog-v43";
const DOC = "./index.html";
const SHELL = ["./", DOC, "./products-catalog.js", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png"];
const DOC_TIMEOUT = 3000;

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

const put = (req, res) => {
  if (res && res.ok && new URL(req.url).origin === location.origin) {
    const copy = res.clone();
    caches.open(V).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // 동기화는 절대 캐시하지 않는다 — 옛 기록을 돌려주면 안 된다
  if (new URL(req.url).hostname.endsWith("workers.dev")) return;

  const isDoc = req.mode === "navigate" ||
                (req.headers.get("accept") || "").includes("text/html");

  if (isDoc) {
    e.respondWith((async () => {
      const cached = caches.match(req).then((h) => h || caches.match(DOC));
      try {
        // 느린 망에서 하염없이 기다리지 않는다. 3초면 캐시를 준다.
        const res = await Promise.race([
          // cache:"no-cache" — 브라우저 HTTP 캐시를 건너뛰고 서버에 물어본다.
          // 그냥 fetch 하면 Pages 의 max-age=600 때문에 10분 묵은 문서가 올 수 있다.
          // 바뀐 게 없으면 304 로 끝나니 비용은 거의 없다.
          fetch(req, { cache: "no-cache" }).then((r) => put(req, r)),
          new Promise((_, rej) => setTimeout(() => rej(new Error("느림")), DOC_TIMEOUT)),
        ]);
        return res;
      } catch {
        return (await cached) || Response.error();
      }
    })());
    return;
  }

  // 그 밖의 것은 캐시 먼저, 뒤에서 갱신
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => put(req, r)).catch(() => hit);
      return hit || net;
    }),
  );
});
