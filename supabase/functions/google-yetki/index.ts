// Google Takvim + Rehber için kalıcı izin (sunucu tarafı OAuth).
// · baslat : ERP'den (oturum açık kullanıcı) → Google izin adresi
// · kod    : google-donus.html'den → kodu yenileme anahtarına çevirip saklar (bir kez)
// · token  : ERP'den → geçerli erişim jetonu (hesap seçtirmeden; gerekirse yeniler)
// · durum  : bağlı mı, hangi hesap
// · kes    : bağlantıyı kaldırır
// Gizli: GOOGLE_CLIENT_SECRET (Supabase → Edge Functions → Secrets)
const SB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CID = Deno.env.get("GOOGLE_CLIENT_ID") || "341229493021-mtj2q3qmnt1e74425m7u5eevtbph7ao9.apps.googleusercontent.com";
const SEC = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const DONUS = "https://gokaysegun.github.io/GunTeknik/google-donus.html";
const HESAP = "gokaysegun@gmail.com";
const KAPSAM = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/contacts",
].join(" ");
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function yanit(veri: unknown, kod = 200) {
  return new Response(JSON.stringify(veri), { status: kod, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function db(yol: string, opts: RequestInit = {}) {
  return fetch(`${SB}/rest/v1/${yol}`, {
    ...opts,
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
}

async function kullanici(req: Request): Promise<{ id: string; rol: string } | null> {
  const a = req.headers.get("authorization") || "";
  if (!a.startsWith("Bearer ")) return null;
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: SR, Authorization: a } });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  let rol = "admin";
  try {
    const p = await (await db(`kullanici_profiller?id=eq.${u.id}&select=rol`)).json();
    if (Array.isArray(p) && p[0]?.rol) rol = p[0].rol;
  } catch (_) { /* yok sayılır */ }
  return { id: u.id, rol };
}

async function baglanti() {
  const r = await (await db("google_baglanti?id=eq.1&select=*")).json();
  return Array.isArray(r) ? r[0] : null;
}

function jwtIcerik(j: string) {
  try {
    const p = j.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p + "===".slice((p.length + 3) % 4)), (c) => c.charCodeAt(0))));
  } catch (_) {
    return {};
  }
}

async function erisim() {
  const g = await baglanti();
  if (!g?.refresh_token) return { hata: "bagli_degil" };
  const kalan = g.son_kullanma ? new Date(g.son_kullanma).getTime() - Date.now() : 0;
  if (g.access_token && kalan > 120000) {
    return { access_token: g.access_token, expires_in: Math.floor(kalan / 1000), email: g.email };
  }
  if (!SEC) return { hata: "gizli_yok", mesaj: "GOOGLE_CLIENT_SECRET tanımlı değil" };
  const t = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: SEC, refresh_token: g.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await t.json().catch(() => ({}));
  if (!t.ok || !j.access_token) {
    if (j.error === "invalid_grant") {
      await db("google_baglanti?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ refresh_token: null, access_token: null, durum: "İzin geri alındı / süresi doldu: " + (j.error_description || j.error), guncellendi: new Date().toISOString() }),
      });
      return { hata: "bagli_degil" };
    }
    return { hata: "google", mesaj: j.error_description || j.error || `HTTP ${t.status}` };
  }
  const son = new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString();
  await db("google_baglanti?id=eq.1", {
    method: "PATCH",
    body: JSON.stringify({ access_token: j.access_token, son_kullanma: son, durum: "bagli", guncellendi: new Date().toISOString() }),
  });
  return { access_token: j.access_token, expires_in: j.expires_in || 3600, email: g.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return yanit({ hata: "yontem" }, 405);
  let g: Record<string, string> = {};
  try { g = await req.json(); } catch (_) { /* boş */ }
  const islem = g.islem || "";

  try {
    if (islem === "kod") {
      // google-donus.html → kod + durum (kullanıcı oturumu gerekmez; durum anahtarı tek kullanımlık)
      const durum = String(g.durum || "");
      if (!durum || !g.kod) return yanit({ hata: "eksik" }, 400);
      const d = await (await db(`google_yetki_durum?durum=eq.${encodeURIComponent(durum)}&select=*`)).json();
      await db(`google_yetki_durum?durum=eq.${encodeURIComponent(durum)}`, { method: "DELETE" });
      if (!Array.isArray(d) || !d[0] || Date.now() - new Date(d[0].olusturma).getTime() > 20 * 60000) {
        return yanit({ hata: "durum", mesaj: "Bağlantı isteğinin süresi dolmuş; ERP'den yeniden başlat." }, 400);
      }
      if (!SEC) return yanit({ hata: "gizli_yok", mesaj: "Sunucuda GOOGLE_CLIENT_SECRET tanımlı değil." }, 500);
      const t = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: g.kod, client_id: CID, client_secret: SEC, redirect_uri: DONUS, grant_type: "authorization_code" }),
      });
      const j = await t.json().catch(() => ({}));
      if (!t.ok || !j.access_token) return yanit({ hata: "google", mesaj: j.error_description || j.error || `HTTP ${t.status}` }, 400);
      const eski = await baglanti();
      const rt = j.refresh_token || eski?.refresh_token;
      if (!rt) return yanit({ hata: "yenileme_yok", mesaj: "Google kalıcı izin vermedi; myaccount.google.com → Güvenlik → Üçüncü taraf erişimi'nden Gün Teknik'i kaldırıp tekrar bağla." }, 400);
      const email = jwtIcerik(j.id_token || "").email || eski?.email || null;
      await db("google_baglanti", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: 1, email, refresh_token: rt, access_token: j.access_token,
          son_kullanma: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString(),
          kapsam: j.scope || KAPSAM, durum: "bagli", baglayan: d[0].kullanici, guncellendi: new Date().toISOString(),
        }),
      });
      return yanit({ ok: true, email, uyari: email && email !== HESAP ? `Bağlanan hesap ${email} (beklenen ${HESAP})` : null });
    }

    const u = await kullanici(req);
    if (!u) return yanit({ hata: "oturum" }, 401);

    if (islem === "baslat") {
      if (u.rol !== "admin") return yanit({ hata: "yetki", mesaj: "Yalnız yönetici bağlayabilir" }, 403);
      if (!SEC) return yanit({ hata: "gizli_yok", mesaj: "Önce Supabase'e GOOGLE_CLIENT_SECRET girilmeli." }, 400);
      const durum = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await db("google_yetki_durum?olusturma=lt." + encodeURIComponent(new Date(Date.now() - 3600000).toISOString()), { method: "DELETE" });
      await db("google_yetki_durum", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ durum, kullanici: u.id }) });
      const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: CID, redirect_uri: DONUS, response_type: "code", scope: KAPSAM,
        access_type: "offline", prompt: "consent", include_granted_scopes: "true", login_hint: HESAP, state: durum,
      }).toString();
      return yanit({ url });
    }
    if (islem === "token") return yanit(await erisim());
    if (islem === "durum") {
      const b = await baglanti();
      return yanit({ bagli: !!b?.refresh_token, email: b?.email || null, durum: b?.durum || null, gizli: !!SEC, guncellendi: b?.guncellendi || null });
    }
    if (islem === "kes") {
      if (u.rol !== "admin") return yanit({ hata: "yetki" }, 403);
      const b = await baglanti();
      if (b?.refresh_token) {
        await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(b.refresh_token), { method: "POST" }).catch(() => {});
      }
      await db("google_baglanti?id=eq.1", { method: "PATCH", body: JSON.stringify({ refresh_token: null, access_token: null, durum: "kaldırıldı", guncellendi: new Date().toISOString() }) });
      return yanit({ ok: true });
    }
    return yanit({ hata: "islem" }, 400);
  } catch (e) {
    return yanit({ hata: "sunucu", mesaj: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});
