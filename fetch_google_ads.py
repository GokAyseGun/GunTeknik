"""
Gün Teknik ERP — Google Ads veri çekme script'i
GitHub Actions tarafından saatlik çalıştırılır.
Google Ads API'den son 30 günün kampanya performans verilerini çeker,
günlük kırılımda Supabase'deki google_ads_metrics tablosuna upsert eder.
"""
import os
import sys
import json
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
        print("Kullanılan CLIENT_ID (ilk 20 karakter):", CLIENT_ID[:20], file=sys.stderr)
        print("CLIENT_ID uzunluğu:", len(CLIENT_ID), file=sys.stderr)
        print("CLIENT_SECRET uzunluğu:", len(CLIENT_SECRET), file=sys.stderr)
        print("REFRESH_TOKEN uzunluğu:", len(REFRESH_TOKEN), file=sys.stderr)
        resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_campaign_metrics(access_token):
    """Son 30 günün kampanya metriklerini günlük kırılımda çeker."""
    url = f"https://googleads.googleapis.com/{API_VERSION}/customers/{CUSTOMER_ID}/googleAds:searchStream"
    headers = {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": LOGIN_CUSTOMER_ID,
        "Authorization": f"Bearer {access_token}",
    }
    query = """
        SELECT
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
        ORDER BY segments.date ASC
    """
    resp = requests.post(url, headers=headers, json={"query": query}, timeout=60)
    if not resp.ok:
        print("Google Ads API hatası:", resp.status_code, resp.text[:2000], file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def fetch_keyword_metrics(access_token):
    """Son 30 günün anahtar kelime performansını günlük kırılımda çeker."""
    url = f"https://googleads.googleapis.com/{API_VERSION}/customers/{CUSTOMER_ID}/googleAds:searchStream"
    headers = {
        "Content-Type": "application/json",
        "developer-token": DEVELOPER_TOKEN,
        "login-customer-id": LOGIN_CUSTOMER_ID,
        "Authorization": f"Bearer {access_token}",
    }
    query = """
        SELECT
          segments.date,
          ad_group_criterion.keyword.text,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM keyword_view
        WHERE segments.date DURING LAST_30_DAYS
          AND ad_group_criterion.status != 'REMOVED'
        ORDER BY segments.date ASC
    """
    resp = requests.post(url, headers=headers, json={"query": query}, timeout=60)
    if not resp.ok:
        print("Google Ads API hatası (anahtar kelime):", resp.status_code, resp.text[:2000], file=sys.stderr)
        resp.raise_for_status()
    return resp.json()


def aggregate_by_date(stream_chunks):
    """SearchStream yanıtını (birden fazla kampanya satırı olabilir) tarihe göre toplar."""
    by_date = {}
    for chunk in stream_chunks:
        for row in chunk.get("results", []):
            seg = row.get("segments", {})
            metrics = row.get("metrics", {})
            tarih = seg.get("date")
            if not tarih:
                continue
            d = by_date.setdefault(tarih, {
                "gosterim": 0, "tiklama": 0, "harcama_micros": 0,
                "donusum": 0.0, "donusum_degeri_micros": 0, "telefon_aramasi": 0,
                "ctr_sum": 0.0, "cpc_micros_sum": 0.0, "row_count": 0,
            })
            d["gosterim"] += int(metrics.get("impressions", 0))
            d["tiklama"] += int(metrics.get("clicks", 0))
            d["harcama_micros"] += int(metrics.get("costMicros", 0))
            d["donusum"] += float(metrics.get("conversions", 0))
            d["donusum_degeri_micros"] += int(float(metrics.get("conversionsValue", 0)) * 1_000_000)
            d["telefon_aramasi"] += int(metrics.get("phoneCalls", 0))
            d["ctr_sum"] += float(metrics.get("ctr", 0))
            d["cpc_micros_sum"] += int(metrics.get("averageCpc", 0))
            d["row_count"] += 1
    return by_date


def aggregate_keywords_by_date(stream_chunks):
    """Anahtar kelime SearchStream yanıtını (tarih, kelime) ikilisine göre toplar."""
    by_key = {}
    for chunk in stream_chunks:
        for row in chunk.get("results", []):
            seg = row.get("segments", {})
            metrics = row.get("metrics", {})
            ad_group_criterion = row.get("adGroupCriterion", {})
            tarih = seg.get("date")
            kelime = ad_group_criterion.get("keyword", {}).get("text")
            if not tarih or not kelime:
                continue
            key = (tarih, kelime)
            d = by_key.setdefault(key, {
                "gosterim": 0, "tiklama": 0, "harcama_micros": 0, "donusum": 0.0,
            })
            d["gosterim"] += int(metrics.get("impressions", 0))
            d["tiklama"] += int(metrics.get("clicks", 0))
            d["harcama_micros"] += int(metrics.get("costMicros", 0))
            d["donusum"] += float(metrics.get("conversions", 0))
    return by_key


def upsert_to_supabase(by_date):
    """Her günü Supabase'e tek satır olarak upsert eder (tarih UNIQUE)."""
    url = f"{SUPABASE_URL}/rest/v1/google_ads_metrics"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    rows = []
    for tarih, d in by_date.items():
        harcama = d["harcama_micros"] / 1_000_000
        donusum = d["donusum"]
        donusum_basi = (harcama / donusum) if donusum > 0 else 0
        ctr = (d["ctr_sum"] / d["row_count"]) if d["row_count"] else 0
        cpc = (d["cpc_micros_sum"] / d["row_count"] / 1_000_000) if d["row_count"] else 0
        rows.append({
            "tarih": tarih,
            "gosterim": d["gosterim"],
            "tiklama": d["tiklama"],
            "harcama": round(harcama, 2),
            "donusum": round(donusum, 2),
            "donusum_basi_maliyet": round(donusum_basi, 2),
            "tiklama_orani": round(ctr, 4),
            "ortalama_tiklama_maliyeti": round(cpc, 2),
            "telefon_aramasi": d["telefon_aramasi"],
            "donusum_degeri": round(d["donusum_degeri_micros"] / 1_000_000, 2),
        })
    if not rows:
        print("Aktarılacak veri bulunamadı.")
        return
    resp = requests.post(url + "?on_conflict=tarih", headers=headers, json=rows, timeout=30)
    if not resp.ok:
        print("Supabase hatası:", resp.status_code, resp.text[:2000], file=sys.stderr)
        resp.raise_for_status()
    print(f"{len(rows)} günlük kayıt Supabase'e yazıldı.")


def upsert_keywords_to_supabase(by_key):
    """Her (tarih, kelime) ikilisini Supabase'e upsert eder."""
    url = f"{SUPABASE_URL}/rest/v1/google_ads_keywords"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    rows = []
    for (tarih, kelime), d in by_key.items():
        rows.append({
            "tarih": tarih,
            "kelime": kelime,
            "gosterim": d["gosterim"],
            "tiklama": d["tiklama"],
            "harcama": round(d["harcama_micros"] / 1_000_000, 2),
            "donusum": round(d["donusum"], 2),
        })
    if not rows:
        print("Aktarılacak anahtar kelime verisi bulunamadı.")
        return
    # Supabase'e büyük listeleri parça parça gönder (tek istekte 500 satır sınırı aşılmasın)
    batch_size = 200
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        resp = requests.post(url + "?on_conflict=tarih,kelime", headers=headers, json=batch, timeout=30)
        if not resp.ok:
            print("Supabase hatası (anahtar kelime):", resp.status_code, resp.text[:2000], file=sys.stderr)
            resp.raise_for_status()
    print(f"{len(rows)} anahtar kelime kaydı Supabase'e yazıldı.")


def main():
    access_token = get_access_token()

    data = fetch_campaign_metrics(access_token)
    by_date = aggregate_by_date(data)
    upsert_to_supabase(by_date)

    keyword_data = fetch_keyword_metrics(access_token)
    by_key = aggregate_keywords_by_date(keyword_data)
    upsert_keywords_to_supabase(by_key)


if __name__ == "__main__":
    main()
