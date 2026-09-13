// 어촌관광정보앱 Cloudflare Worker v0.4
// 2026-09-12
// Cloudflare Secret은 KTO_API_KEY 1개만 사용.
// 한국관광공사 8개 서비스의 Base Endpoint는 Worker 내부에 고정.
// 실제 인증키는 이 파일에 절대 넣지 마십시오.

const VERSION = "0.4.0";

const TRANSIENT = new Set([408,425,429,500,502,503,504,520,521,522,523,524]);
const MAX_ROWS = 100;
const MAX_RADIUS = 20000;
const TIMEOUT_MS = 8000;
const ATTEMPTS = 2;

const SERVICES = {
  areaResourceDemand: {
    id: "AreaTarResDemService",
    base: "https://apis.data.go.kr/B551011/AreaTarResDemService",
    operations: ["areaTarSvcDemList", "areaCulResDemList"]
  },
  areaDiversity: {
    id: "AreaTarDivService",
    base: "https://apis.data.go.kr/B551011/AreaTarDivService",
    operations: ["areaTouDivList", "areaExpDivList", "areaIntlDivList"]
  },
  areaDemandStrength: {
    id: "AreaTarDemDsService",
    base: "https://apis.data.go.kr/B551011/AreaTarDemDsService",
    operations: ["areaTarSjrnDsList", "areaTarExpDsList"]
  },
  relatedTour: {
    id: "TarRlteTarService1",
    base: "https://apis.data.go.kr/B551011/TarRlteTarService1",
    operations: ["areaBasedList1", "searchKeyword1"]
  },
  kor: {
    id: "KorService2",
    base: "https://apis.data.go.kr/B551011/KorService2",
    operations: [
      "areaCode2","categoryCode2","areaBasedList2","locationBasedList2",
      "searchKeyword2","searchFestival2","searchStay2","detailCommon2",
      "detailIntro2","detailInfo2","detailImage2","areaBasedSyncList2",
      "detailPetTour2","ldongCode2","lclsSystmCode2"
    ]
  },
  localHub: {
    id: "LocgoHubTarService1",
    base: "https://apis.data.go.kr/B551011/LocgoHubTarService1",
    operations: ["areaBasedList1"]
  },
  concentration: {
    id: "TatsCnctrRateService",
    base: "https://apis.data.go.kr/B551011/TatsCnctrRateService",
    operations: ["tatsCnctrRatedList", "tatsCnctrRateList"]
  },
  pet: {
    id: "KorPetTourService2",
    base: "https://apis.data.go.kr/B551011/KorPetTourService2",
    operations: [
      "ldongCode2","areaBasedList2","locationBasedList2","searchKeyword2",
      "detailCommon2","detailIntro2","detailInfo2","detailImage2",
      "detailPetTour2","petTourSyncList2","lclsSystmCode2"
    ]
  }
};

function decodeKey(env) {
  const raw = String(env.KTO_API_KEY || "").trim();
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function cors(req, env) {
  const origin = req.headers.get("Origin") || "*";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",").map(x => x.trim()).filter(Boolean);

  const allow = !allowed.length
    ? "*"
    : (allowed.includes(origin) ? origin : allowed[0]);

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Vary": "Origin"
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function clamp(v, min, max, def) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

function asItems(body) {
  let it = body?.response?.body?.items?.item ?? [];
  if (!Array.isArray(it)) it = it ? [it] : [];
  return it;
}

function ktoHeader(body) {
  const h = body?.response?.header || {};
  return {
    code: String(h.resultCode ?? ""),
    msg: String(h.resultMsg ?? "")
  };
}

function normalizeTourItems(items) {
  return items.map(x => ({
    contentId: String(x.contentid || ""),
    contentTypeId: String(x.contenttypeid || ""),
    title: x.title || "",
    address: [x.addr1, x.addr2].filter(Boolean).join(" "),
    lat: Number(x.mapy),
    lon: Number(x.mapx),
    distanceM: x.dist == null ? null : Number(x.dist),
    image: x.firstimage2 || x.firstimage || "",
    imageOriginal: x.firstimage || "",
    tel: x.tel || "",
    modifiedTime: x.modifiedtime || "",
    copyrightCode: x.cpyrhtDivCd || ""
  }));
}

async function upstream(url) {
  let last;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: ctl.signal,
        headers: { "Accept": "application/json" }
      });

      clearTimeout(timer);
      last = res;

      if (res.ok || !TRANSIENT.has(res.status) || attempt === ATTEMPTS) {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      if (attempt === ATTEMPTS) throw e;
    }

    await new Promise(r => setTimeout(r, 250 * attempt));
  }

  return last;
}

function publicParams(searchParams) {
  const out = {};
  for (const [k, v] of searchParams.entries()) {
    if (k === "serviceKey") continue;
    out[k] = v;
  }
  return out;
}

function makeUrl(serviceAlias, operation, env, params = {}) {
  const svc = SERVICES[serviceAlias];
  if (!svc) throw new Error(`Unknown KTO service: ${serviceAlias}`);
  if (!svc.operations.includes(operation)) {
    throw new Error(`Unsupported operation for ${serviceAlias}: ${operation}`);
  }

  const key = decodeKey(env);
  if (!key) throw new Error("KTO_API_KEY secret is not configured");

  const u = new URL(`${svc.base}/${operation}`);

  const baseParams = {
    serviceKey: key,
    MobileOS: "ETC",
    MobileApp: "KAFV_FishingVillageTourism",
    _type: "json",
    pageNo: "1",
    numOfRows: String(clamp(params.numOfRows, 1, MAX_ROWS, 20))
  };

  const merged = { ...baseParams, ...params };
  merged.serviceKey = key;       // 외부 query의 serviceKey 덮어쓰기 금지
  merged._type = "json";         // Worker는 JSON으로 통일

  for (const [k, v] of Object.entries(merged)) {
    if (v !== "" && v !== null && v !== undefined) {
      u.searchParams.set(k, String(v));
    }
  }

  return u;
}

// Secret이 포함되지 않는 별도 캐시 키를 사용한다.
function makeCacheKey(serviceAlias, operation, params) {
  const u = new URL(`https://kto-cache.kafv.local/${serviceAlias}/${operation}`);
  const clean = { ...params };
  delete clean.serviceKey;

  Object.keys(clean).sort().forEach(k => {
    const v = clean[k];
    if (v !== "" && v !== null && v !== undefined) {
      u.searchParams.set(k, String(v));
    }
  });

  return new Request(u.toString(), { method: "GET" });
}

function parsePossibleXmlError(text) {
  const pick = (tag) => {
    const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? m[1].trim() : "";
  };

  const msg =
    pick("returnAuthMsg") ||
    pick("resultMsg") ||
    pick("errMsg") ||
    pick("cmmMsgHeader");

  const code =
    pick("returnReasonCode") ||
    pick("resultCode") ||
    pick("errCode");

  if (msg || code) return { code, msg };
  return null;
}

async function cachedKtoJson(serviceAlias, operation, env, params, ttl = 900) {
  const cache = caches.default;
  const cacheKey = makeCacheKey(serviceAlias, operation, params);

  const hit = await cache.match(cacheKey);
  if (hit) {
    const body = await hit.json();
    return body;
  }

  const url = makeUrl(serviceAlias, operation, env, params);
  const res = await upstream(url);
  const text = await res.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    const xmlErr = parsePossibleXmlError(text);
    if (xmlErr) {
      throw new Error(
        `KTO ${xmlErr.code || "ERROR"}: ${xmlErr.msg || "XML error response"}`
      );
    }
    throw new Error(`KTO upstream non-JSON response (${res.status})`);
  }

  const h = ktoHeader(body);

  // NODATA(03)는 호출 자체는 정상으로 보고 빈 결과로 반환한다.
  if (h.code === "03") {
    body.response = body.response || {};
    body.response.body = body.response.body || {};
    body.response.body.items = { item: [] };
    body.response.body.totalCount = 0;
  } else if (!res.ok || !["0000", "00"].includes(h.code)) {
    throw new Error(h.msg || `KTO upstream ${res.status} / ${h.code}`);
  }

  if (res.ok) {
    const store = new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": `public,max-age=${ttl}`
      }
    });
    await cache.put(cacheKey, store);
  }

  return body;
}

function parseTypes(raw) {
  return [...new Set(
    String(raw || "")
      .split(",")
      .map(x => x.trim())
      .filter(x => /^\d+$/.test(x))
  )].slice(0, 6);
}

async function nearby(req, env, pet = false) {
  const q = new URL(req.url).searchParams;

  const mapX = Number(q.get("mapX"));
  const mapY = Number(q.get("mapY"));

  if (!Number.isFinite(mapX) || !Number.isFinite(mapY)) {
    throw new Error("mapX/mapY are required");
  }

  const radius = clamp(q.get("radius"), 100, MAX_RADIUS, 3000);
  const numOfRows = clamp(q.get("numOfRows"), 1, MAX_ROWS, 24);
  const types = parseTypes(q.get("contentTypeId"));

  const alias = pet ? "pet" : "kor";
  const targets = types.length ? types : [""];

  const bodies = await Promise.all(
    targets.map(type =>
      cachedKtoJson(alias, "locationBasedList2", env, {
        mapX,
        mapY,
        radius,
        numOfRows,
        arrange: "E",
        contentTypeId: type
      }, 900)
    )
  );

  const merged = [];
  let upstreamTotal = 0;

  for (const body of bodies) {
    const list = normalizeTourItems(asItems(body));
    merged.push(...list);
    upstreamTotal += Number(body?.response?.body?.totalCount || list.length);
  }

  const seen = new Set();
  const items = merged
    .filter(x => {
      const k = x.contentId || `${x.title}|${x.lat}|${x.lon}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) =>
      (Number(a.distanceM) || 1e15) - (Number(b.distanceM) || 1e15)
    )
    .slice(0, numOfRows);

  return {
    ok: true,
    service: SERVICES[alias].id,
    operation: "locationBasedList2",
    radiusM: radius,
    requestedTypes: types,
    totalCount: types.length > 1 ? items.length : upstreamTotal,
    items
  };
}

async function detail(req, env, pet = false) {
  const q = new URL(req.url).searchParams;
  const id = q.get("contentId") || q.get("id");

  if (!id) throw new Error("contentId is required");

  const alias = pet ? "pet" : "kor";

  const common = await cachedKtoJson(
    alias,
    "detailCommon2",
    env,
    { contentId: id, numOfRows: 10 },
    1800
  );

  const commonItem = asItems(common)[0] || {};
  let petItem = {};

  if (pet) {
    const p = await cachedKtoJson(
      alias,
      "detailPetTour2",
      env,
      { contentId: id, numOfRows: 10 },
      1800
    );
    petItem = asItems(p)[0] || {};
  }

  return {
    ok: true,
    service: SERVICES[alias].id,
    item: { ...commonItem, ...petItem }
  };
}

// 8개 서비스 공통 호출.
// 예:
// /api/kto/areaResourceDemand/areaTarSvcDemList?baseYm=202509&areaCd=11&signguCd=11530
// /api/kto/relatedTour/searchKeyword1?baseYm=202504&areaCd=51&signguCd=51130&keyword=뮤지엄산
// /api/kto/localHub/areaBasedList1?baseYm=202504&areaCd=11&signguCd=11530
// /api/kto/concentration/tatsCnctrRatedList?areaCd=51&signguCd=51130&tAtsNm=간현관광지
async function genericKto(req, env, serviceAlias, operation) {
  const svc = SERVICES[serviceAlias];
  if (!svc) throw new Error(`Unknown KTO service: ${serviceAlias}`);
  if (!svc.operations.includes(operation)) {
    throw new Error(`Unsupported operation for ${serviceAlias}: ${operation}`);
  }

  const q = new URL(req.url).searchParams;
  const params = publicParams(q);

  const body = await cachedKtoJson(
    serviceAlias,
    operation,
    env,
    params,
    900
  );

  const h = ktoHeader(body);

  return {
    ok: true,
    service: svc.id,
    alias: serviceAlias,
    operation,
    resultCode: h.code,
    resultMsg: h.msg,
    body: body?.response?.body || {}
  };
}

function catalog() {
  const services = {};
  for (const [alias, svc] of Object.entries(SERVICES)) {
    services[alias] = {
      serviceId: svc.id,
      endpoint: svc.base,
      operations: svc.operations
    };
  }

  return {
    ok: true,
    version: VERSION,
    secretRequired: "KTO_API_KEY",
    serviceCount: Object.keys(SERVICES).length,
    services
  };
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: h });
    }

    if (req.method !== "GET") {
      return json({ ok: false, error: "GET only" }, 405, h);
    }

    const u = new URL(req.url);

    try {
      if (u.pathname === "/api/health") {
        return json({
          ok: true,
          service: "KAFV fishing-village-tourism worker",
          version: VERSION,
          ktoSecretConfigured: Boolean(String(env.KTO_API_KEY || "").trim()),
          serviceCount: 8
        }, 200, h);
      }

      if (u.pathname === "/api/kto/catalog") {
        return json(catalog(), 200, h);
      }

      // 기존 어촌관광정보앱 호환 경로
      if (u.pathname === "/api/tour/nearby") {
        return json(await nearby(req, env, false), 200, h);
      }

      if (u.pathname === "/api/pet/nearby") {
        return json(await nearby(req, env, true), 200, h);
      }

      if (u.pathname === "/api/tour/detail") {
        return json(await detail(req, env, false), 200, h);
      }

      if (u.pathname === "/api/pet/detail") {
        return json(await detail(req, env, true), 200, h);
      }

      // 8개 서비스 범용 경로
      // /api/kto/{alias}/{operation}
      const m = u.pathname.match(/^\/api\/kto\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
      if (m) {
        const [, alias, operation] = m;
        return json(await genericKto(req, env, alias, operation), 200, h);
      }

      return json({
        ok: false,
        error: "Not found",
        hints: [
          "/api/health",
          "/api/kto/catalog",
          "/api/tour/nearby?mapX=129.0&mapY=35.0&radius=3000",
          "/api/pet/nearby?mapX=129.0&mapY=35.0&radius=3000",
          "/api/kto/{alias}/{operation}"
        ]
      }, 404, h);

    } catch (e) {
      const msg = e?.name === "AbortError"
        ? "KTO upstream timeout"
        : String(e?.message || e);

      return json({ ok: false, error: msg }, 503, h);
    }
  }
};
