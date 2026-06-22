"""
Gün Teknik ERP — Google Ads veri çekme script'i
GitHub Actions tarafından saatlik çalıştırılır.
Tüm kampanyaların son 30 günlük performansını kampanya bazında ayrı ayrı çeker.
"""
import os
import sys
import requests

# --- Ortam değişkenleri (GitHub Secrets'tan gelir) ---
DEVELOPER_TOKEN = os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"]
CLIENT_ID = os.environ["GOOGLE_ADS_CLIENT_ID"]
CLIENT_SECRET = os.environ["GOOGLE_ADS_CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["GOOGLE_ADS_REFRESH_TOKEN"]
CUSTOMER_ID = os.environ["GOOGLE_ADS_CUSTOMER_ID"]
LOGIN_CUSTOMER_ID = os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

API_VERSION = "v23"


def get_access_token():
    """Refresh token ile geçici bir access token alır."""
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "refresh_token": REFRESH_TOKEN,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if not resp.ok:
        print("Token yenileme hatası:", resp.status_code, resp.text, file=sys.stderr)
        resp.raise_for_status()
    return resp.json()["access_token"]


def ads_search(access_token, query):
    """Google Ads API searchStream çağrısı yapar."""
    url = f"https://googleads.googleapis.com/{API_VERSION}/customers/{CUSTOMER_ID}/googleAds:searchStream"
    headers = {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": LOGIN_CUSTOMER_ID,
        "Authorization": f"Bearer {access_token}",
    }
    resp = requests.post(url, headers=headers, json={"query": query}, timeout=60)
    if not resp.ok:
        print("Google Ads API hatası:", resp.status_code, resp.text[:2000], file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def fetch_campaign_metrics(access_token):
    """Son 30 günün kampanya metriklerini kampanya + gün bazında çeker."""
    query = """
        SELECT
          campaign.id,
          campaign.name,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.cost_per_conversion,
          metrics.ctr,
          metrics.average_cpc,
          metrics.phone_calls
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
          AND campaign.status != 'REMOVED'
        ORDER BY campaign.id ASC, segments.date ASC
    """
    return ads_search(access_token, query)


def fetch_keyword_metrics(access_token):
    """Son 30 günün anahtar kelime performansını kampanya + gün + kelime bazında çeker."""
    query = """
        SELECT
          campaign.id,
          campaign.name,
          segments.date,
          ad_group_criterion.keyword.text,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM keyword_view
        WHERE segments.date DURING LAST_30_DAYS
          AND ad_group_criterion.status != 'REMOVED'
        ORDER BY campaign.id ASC, segments.date ASC
    """
    return ads_search(access_token, query)


def aggregate_campaign_by_date(stream_chunks):
    """Her (kampanya_id, tarih) için metrikleri toplar."""
    by_key = {}
    for chunk in stream_chunks:
        for row in chunk.get("results", []):
            seg = row.get("segments", {})
            metrics = row.get("metrics", {})
            camp = row.get("campaign", {})
            tarih = seg.get("date")
            kampanya_id = str(camp.get("id", ""))
            kampanya_adi = camp.get("name", "")
            if not tarih or not kampanya_id:
                continue
            key = (kampanya_id, tarih)
            d = by_key.setdefault(key, {
                "kampanya_id": kampanya_id,
                "kampanya_adi": kampanya_adi,
                "gosterim": 0, "tiklama": 0, "harcama_micros": 0,
                "donusum": 0.0, "donusum_degeri": 0.0, "telefon_aramasi": 0,
                "ctr_sum": 0.0, "cpc_micros_sum": 0.0, "row_count": 0,
            })
            d["gosterim"] += int(metrics.get("impressions", 0))
            d["tiklama"] += int(metrics.get("clicks", 0))
            d["harcama_micros"] += int(metrics.get("costMicros", 0))
            d["donusum"] += float(metrics.get("conversions", 0))
            d["donusum_degeri"] += float(metrics.get("conversionsValue", 0))
            d["telefon_aramasi"] += int(metrics.get("phoneCalls", 0))
            d["ctr_sum"] += float(metrics.get("ctr", 0))
            d["cpc_micros_sum"] += int(metrics.get("averageCpc", 0))
            d["row_count"] += 1
    return by_key


def aggregate_keywords(stream_chunks):
    """Her (kampanya_id, tarih, kelime) üçlüsü için metrikleri toplar."""
    by_key = {}
    toplam_ham_satir = 0
    for chunk in stream_chunks:
        for row in chunk.get("results", []):
            toplam_ham_satir += 1
            seg = row.get("segments", {})
            metrics = row.get("metrics", {})
            camp = row.get("campaign", {})
            crit = row.get("adGroupCriterion", {})
            tarih = seg.get("date")
            kampanya_id = str(camp.get("id", ""))
            kampanya_adi = camp.get("name", "")
            kelime = crit.get("keyword", {}).get("text")
            if not tarih or not kelime or not kampanya_id:
                continue
            key = (kampanya_id, tarih, kelime)
            d = by_key.setdefault(key, {
                "kampanya_id": kampanya_id,
                "kampanya_adi": kampanya_adi,
                "gosterim": 0, "tiklama": 0, "harcama_micros": 0, "donusum": 0.0,
            })
            d["gosterim"] += int(metrics.get("impressions", 0))
            d["tiklama"] += int(metrics.get("clicks", 0))
            d["harcama_micros"] += int(metrics.get("costMicros", 0))
            d["donusum"] += float(metrics.get("conversions", 0))
    print(f"[DEBUG] Ham API satır sayısı: {toplam_ham_satir}, Benzersiz (kampanya+tarih+kelime): {len(by_key)}", file=sys.stderr)
    kelimeler = set(k[2] for k in by_key.keys())
    print(f"[DEBUG] Benzersiz kelime sayısı: {len(kelimeler)}", file=sys.stderr)
    return by_key


def supabase_upsert(table, rows, on_conflict, batch_size=200):
    """Supabase REST API ile toplu upsert yapar."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        resp = requests.post(
            f"{url}?on_conflict={on_conflict}",
            headers=headers, json=batch, timeout=30
        )
        if not resp.ok:
            print(f"Supabase hatası ({table}):", resp.status_code, resp.text[:2000], file=sys.stderr)
            resp.raise_for_status()


def main():
    access_token = get_access_token()

    # --- Kampanya metrikleri ---
    data = fetch_campaign_metrics(access_token)
    by_camp = aggregate_campaign_by_date(data)
    camp_rows = []
    for (kamp_id, tarih), d in by_camp.items():
        harcama = d["harcama_micros"] / 1_000_000
        donusum = d["donusum"]
        donusum_basi = (harcama / donusum) if donusum > 0 else 0
        ctr = (d["ctr_sum"] / d["row_count"]) if d["row_count"] else 0
        cpc = (d["cpc_micros_sum"] / d["row_count"] / 1_000_000) if d["row_count"] else 0
        camp_rows.append({
            "tarih": tarih,
            "kampanya_id": kamp_id,
            "kampanya_adi": d["kampanya_adi"],
            "gosterim": d["gosterim"],
            "tiklama": d["tiklama"],
            "harcama": round(harcama, 2),
            "donusum": round(donusum, 2),
            "donusum_basi_maliyet": round(donusum_basi, 2),
            "tiklama_orani": round(ctr, 4),
            "ortalama_tiklama_maliyeti": round(cpc, 2),
            "telefon_aramasi": d["telefon_aramasi"],
            "donusum_degeri": round(d["donusum_degeri"], 2),
        })
    if camp_rows:
        supabase_upsert("google_ads_metrics", camp_rows, "tarih,kampanya_id")
        print(f"{len(camp_rows)} kampanya/gün kaydı Supabase'e yazıldı.")
    else:
        print("Aktarılacak kampanya verisi bulunamadı.")

    # --- Anahtar kelime metrikleri ---
    kw_data = fetch_keyword_metrics(access_token)
    by_kw = aggregate_keywords(kw_data)
    kw_rows = []
    for (kamp_id, tarih, kelime), d in by_kw.items():
        kw_rows.append({
            "tarih": tarih,
            "kampanya_id": kamp_id,
            "kampanya_adi": d["kampanya_adi"],
            "kelime": kelime,
            "gosterim": d["gosterim"],
            "tiklama": d["tiklama"],
            "harcama": round(d["harcama_micros"] / 1_000_000, 2),
            "donusum": round(d["donusum"], 2),
        })
    if kw_rows:
        supabase_upsert("google_ads_keywords", kw_rows, "tarih,kelime,kampanya_id")
        print(f"{len(kw_rows)} anahtar kelime kaydı Supabase'e yazıldı.")
    else:
        print("Aktarılacak anahtar kelime verisi bulunamadı.")


if __name__ == "__main__":
    main()
