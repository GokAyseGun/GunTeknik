// Strava bağlantısı (Sağlık sayfası): yürüyüş, koşu, bisiklet, trekking aktiviteleri, rota ve profil.
// · baslat : ERP'den (yalnız sağlık sahibi) → Strava izin adresi
// · kod    : strava-donus.html'den → kodu jetonlara çevirip saklar (durum anahtarı tek kullanımlık)
// · cek    : yeni aktiviteleri saglik_aktivite'ye yazar (rota, irtifa/nabız akışı)
// · durum  : bağlı mı, hangi sporcu, son çekim
// · kes    : bağlantıyı kaldırır
// Gizliler veritabanında (saglik_gizli, yalnız sunucu okur): strava_client_id, strava_client_secret.
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DONUS = "https://gokaysegun.github.io/GunTeknik/strava-donus.html";
const KAPSAM = "read,activity:read_all";
const API = "https://www.strava.com/api/v3";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const yanit = (veri: unknown, kod = 200) =>
  new Response(JSON.stringify(veri), { status: kod, headers: { ...CORS, "Content-Type": "application/json" } });

async function db(yol: string, opts: RequestInit = {}) {
  return fetch(`${SB}/rest/v1/${yol}`, {
    ...opts,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
}
async function dbJ(yol: string) { const r = await db(yol); return r.ok ? await r.json() : []; }

async function gizli() {
  const L = await dbJ("saglik_gizli?anahtar=in.(strava_client_id,strava_client_secret)&select=anahtar,deger");
  const m: Record<string, string> = {};
  (Array.isArray(L) ? L : []).forEach((x: { anahtar: string; deger: string }) => (m[x.anahtar] = x.deger));
  return { cid: m.strava_client_id || "", sec: m.strava_client_secret || "" };
}

async function sahip(): Promise<string | null> {
  const r = await dbJ("erp_ayarlar?anahtar=eq.saglik&select=deger");
  return (Array.isArray(r) && r[0]?.deger?.sahip) || null;
}

async function kullanici(req: Request): Promise<string | null> {
  const a = req.headers.get("authorization") || "";
  if (!a.startsWith("Bearer ")) return null;
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SR, Authorization: a } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}

async function baglanti(uid: string) {
  const r = await dbJ(`saglik_strava?kullanici_id=eq.${uid}&select=*`);
  return Array.isArray(r) ? r[0] : null;
}

async function erisim(uid: string): Promise<{ tok?: string; hata?: string; mesaj?: string }> {
  const b = await baglanti(uid);
  if (!b?.refresh_token) return { hata: "bagli_degil" };
  if (b.access_token && b.son_kullanma && new Date(b.son_kullanma).getTime() - Date.now() > 120000) return { tok: b.access_token };
  const { cid, sec } = await gizli();
  const t = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cid, client_secret: sec, grant_type: "refresh_token", refresh_token: b.refresh_token }),
  });
  const j = await t.json().catch(() => ({}));
  if (!t.ok || !j.access_token) {
    if (t.status === 400 || t.status === 401) {
      await db(`saglik_strava?kullanici_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ refresh_token: null, access_token: null, durum: "İzin geri alındı / süresi doldu", guncellendi: new Date().toISOString() }) });
      return { hata: "bagli_degil" };
    }
    return { hata: "strava", mesaj: j.message || `HTTP ${t.status}` };
  }
  await db(`saglik_strava?kullanici_id=eq.${uid}`, {
    method: "PATCH",
    body: JSON.stringify({ access_token: j.access_token, refresh_token: j.refresh_token || b.refresh_token, son_kullanma: new Date(j.expires_at * 1000).toISOString(), durum: "bagli", guncellendi: new Date().toISOString() }),
  });
  return { tok: j.access_token };
}

function tur(s: string): string {
  if (/^(Walk)$/.test(s)) return "yuruyus";
  if (/Run/.test(s)) return "kosu";
  if (/Ride|Cycl|Bike|Velomobile|Handcycle/.test(s)) return "bisiklet";
  if (/Hike/.test(s)) return "trekking";
  if (/WeightTraining|Workout|Crossfit|HighIntensityIntervalTraining|Pilates|Yoga|StairStepper|Elliptical/.test(s)) return "ev";
  return "diger";
}

// akışı ~250 noktaya indir
function seyrelt(a: number[] | undefined, n: number[]): number[] | null {
  if (!a || !a.length) return null;
  return n.map((i) => Math.round(a[i] * 10) / 10);
}

async function akisAl(tok: string, id: number) {
  const r = await fetch(`${API}/activities/${id}/streams?keys=distance,altitude,heartrate,time&key_by_type=true`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) return null;
  const j = await r.json();
  const uz = j?.distance?.data?.length || j?.time?.data?.length || 0;
  if (!uz) return null;
  const adim = Math.max(1, Math.ceil(uz / 250));
  const idx: number[] = []; for (let i = 0; i < uz; i += adim) idx.push(i); if (idx[idx.length - 1] !== uz - 1) idx.push(uz - 1);
  return { mesafe: seyrelt(j.distance?.data, idx), irtifa: seyrelt(j.altitude?.data, idx), nabiz: seyrelt(j.heartrate?.data, idx), zaman: seyrelt(j.time?.data, idx) };
}

async function cek(uid: string, gun: number) {
  const e = await erisim(uid);
  if (!e.tok) return e;
  const b = await baglanti(uid);
  const once = b?.son_cekim ? new Date(b.son_cekim).getTime() - 2 * 86400e3 : Date.now() - gun * 86400e3;
  const sonra = Math.floor(once / 1000);
  const L: any[] = [];
  for (let s = 1; s <= 5; s++) {
    const r = await fetch(`${API}/athlete/activities?after=${sonra}&per_page=100&page=${s}`, { headers: { Authorization: `Bearer ${e.tok}` } });
    if (r.status === 429) return { hata: "sinir", mesaj: "Strava istek sınırı doldu; 15 dk sonra tekrar dene." };
    if (!r.ok) return { hata: "strava", mesaj: `HTTP ${r.status}` };
    const p = await r.json();
    if (!Array.isArray(p) || !p.length) break;
    L.push(...p);
    if (p.length < 100) break;
  }
  const var_ = await dbJ(`saglik_aktivite?kullanici_id=eq.${uid}&kaynak=eq.strava&select=id,dis_id,akis`);
  const vm = new Map<string, any>((Array.isArray(var_) ? var_ : []).map((x: any) => [x.dis_id, x]));
  let yeni = 0, guncel = 0, akis = 0;
  for (const a of L) {
    const bas = new Date(a.start_date).getTime();
    const row: Record<string, unknown> = {
      kullanici_id: uid, kaynak: "strava", dis_id: String(a.id), tur: tur(a.sport_type || a.type || ""), ad: a.name || null,
      baslangic: a.start_date, bitis: new Date(bas + (a.elapsed_time || 0) * 1000).toISOString(),
      sure_sn: a.elapsed_time ?? null, hareket_sn: a.moving_time ?? null, mesafe_m: a.distance ?? null,
      irtifa_m: a.total_elevation_gain ?? null, nabiz_ort: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
      nabiz_max: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
      hiz_ort: a.average_speed != null ? Math.round(a.average_speed * 36) / 10 : null, hiz_max: a.max_speed != null ? Math.round(a.max_speed * 36) / 10 : null,
      kcal: a.kilojoules != null ? Math.round(a.kilojoules * 0.239 / 0.24) : null, rota: a.map?.summary_polyline || null,
    };
    const v = vm.get(String(a.id));
    if (!v?.akis && akis < 25 && (a.distance || 0) > 0) {
      const ak = await akisAl(e.tok, a.id).catch(() => null);
      if (ak) { row.akis = ak; akis++; }
    }
    if (v) { await db(`saglik_aktivite?id=eq.${v.id}`, { method: "PATCH", body: JSON.stringify(row) }); guncel++; }
    else {
      const r = await db("saglik_aktivite", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
      const x = r.ok ? (await r.json())[0] : null; yeni++;
      // saatten (Health Connect) gelen aynı aktivite: ikiz olarak işaretle, iki kez sayılmasın
      if (x?.id) {
        const a0 = new Date(bas - 15 * 60000).toISOString(), a1 = new Date(bas + 15 * 60000).toISOString();
        await db(`saglik_aktivite?kullanici_id=eq.${uid}&kaynak=eq.hc&ikiz_id=is.null&baslangic=gte.${encodeURIComponent(a0)}&baslangic=lte.${encodeURIComponent(a1)}`, { method: "PATCH", body: JSON.stringify({ ikiz_id: x.id }) });
      }
    }
  }
  await db(`saglik_strava?kullanici_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ son_cekim: new Date().toISOString(), durum: "bagli", guncellendi: new Date().toISOString() }) });
  return { ok: true, yeni, guncel, akis, toplam: L.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return yanit({ hata: "yontem" }, 405);
  let g: Record<string, any> = {};
  try { g = await req.json(); } catch (_) { /* boş */ }
  const islem = g.islem || "";
  try {
    if (islem === "kod") {
      const durum = String(g.durum || "");
      if (!durum || !g.kod) return yanit({ hata: "eksik" }, 400);
      const d = await dbJ(`saglik_strava_durum?durum=eq.${encodeURIComponent(durum)}&select=*`);
      await db(`saglik_strava_durum?durum=eq.${encodeURIComponent(durum)}`, { method: "DELETE" });
      if (!Array.isArray(d) || !d[0] || Date.now() - new Date(d[0].olusturma).getTime() > 20 * 60000)
        return yanit({ hata: "durum", mesaj: "Bağlantı isteğinin süresi dolmuş; ERP'den yeniden başlat." }, 400);
      const kapsam = String(g.kapsam || "");
      if (kapsam && !kapsam.includes("activity:read")) return yanit({ hata: "kapsam", mesaj: "Aktivitelerini okuma izni verilmedi. ERP'den yeniden bağlanıp 'aktivitelerini görüntüle' kutusunu işaretli bırak." }, 400);
      const { cid, sec } = await gizli();
      if (!cid || !sec) return yanit({ hata: "gizli_yok", mesaj: "Sunucuda Strava anahtarları tanımlı değil." }, 500);
      const t = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: cid, client_secret: sec, code: g.kod, grant_type: "authorization_code" }),
      });
      const j = await t.json().catch(() => ({}));
      if (!t.ok || !j.access_token) return yanit({ hata: "strava", mesaj: j.message || `HTTP ${t.status}` }, 400);
      const ad = [j.athlete?.firstname, j.athlete?.lastname].filter(Boolean).join(" ") || null;
      await db("saglik_strava?on_conflict=kullanici_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ kullanici_id: d[0].kullanici, athlete_id: j.athlete?.id || null, ad, refresh_token: j.refresh_token, access_token: j.access_token, son_kullanma: new Date(j.expires_at * 1000).toISOString(), kapsam: kapsam || KAPSAM, durum: "bagli", guncellendi: new Date().toISOString() }),
      });
      let sonuc: unknown = null;
      try { sonuc = await cek(d[0].kullanici, 90); } catch (_) { /* ilk çekim ERP'de tekrar denenir */ }
      return yanit({ ok: true, ad, sonuc });
    }

    const uid = await kullanici(req);
    if (!uid) return yanit({ hata: "oturum" }, 401);
    if (uid !== (await sahip())) return yanit({ hata: "yetki" }, 403);

    if (islem === "baslat") {
      const { cid, sec } = await gizli();
      if (!cid || !sec) return yanit({ hata: "gizli_yok", mesaj: "Strava anahtarları henüz sunucuda yok." }, 400);
      const durum = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await db("saglik_strava_durum?olusturma=lt." + encodeURIComponent(new Date(Date.now() - 3600000).toISOString()), { method: "DELETE" });
      await db("saglik_strava_durum", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ durum, kullanici: uid }) });
      const q = new URLSearchParams({ client_id: cid, redirect_uri: DONUS, response_type: "code", approval_prompt: "auto", scope: KAPSAM, state: durum }).toString();
      return yanit({ url: "https://www.strava.com/oauth/authorize?" + q, mobil: "https://www.strava.com/oauth/mobile/authorize?" + q });
    }
    if (islem === "cek") return yanit(await cek(uid, Math.min(365, Math.max(1, Number(g.gun) || 90))));
    if (islem === "durum") {
      const b = await baglanti(uid);
      const { cid, sec } = await gizli();
      return yanit({ bagli: !!b?.refresh_token, ad: b?.ad || null, son_cekim: b?.son_cekim || null, durum: b?.durum || null, hazir: !!(cid && sec) });
    }
    if (islem === "kes") {
      const e = await erisim(uid);
      if (e.tok) await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: `Bearer ${e.tok}` } }).catch(() => {});
      await db(`saglik_strava?kullanici_id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ refresh_token: null, access_token: null, durum: "kaldırıldı", guncellendi: new Date().toISOString() }) });
      return yanit({ ok: true });
    }
    return yanit({ hata: "islem" }, 400);
  } catch (e) {
    return yanit({ hata: "sunucu", mesaj: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
