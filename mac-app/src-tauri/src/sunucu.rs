//! Supabase RPC çağrıları (anon anahtar + cihaz anahtarı) — Android'deki Sunucu.java'nın karşılığı.
use serde_json::{json, Value};
use std::time::Duration;

pub const SB_URL: &str = "https://zfflnrerdevnflchscqe.supabase.co";
pub const SB_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZmxucmVyZGV2bmZsY2hzY3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzQ3MjUsImV4cCI6MjA5NjQxMDcyNX0.uby8MidaKpnsceel5E_zTJm3LTYwoMrbKUryr5ZszcI";

pub fn istemci() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("GunTeknik-Mac")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub async fn rpc(fonksiyon: &str, govde: Value) -> Result<Value, String> {
    let r = istemci()
        .post(format!("{SB_URL}/rest/v1/rpc/{fonksiyon}"))
        .header("apikey", SB_KEY)
        .header("Authorization", format!("Bearer {SB_KEY}"))
        .json(&govde)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let kod = r.status();
    let metin = r.text().await.map_err(|e| e.to_string())?;
    if !kod.is_success() {
        let ileti = serde_json::from_str::<Value>(&metin)
            .ok()
            .and_then(|j| j.get("message").and_then(|m| m.as_str()).map(String::from))
            .unwrap_or(metin);
        return Err(format!("{} {}", kod.as_u16(), ileti));
    }
    if metin.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&metin).map_err(|e| e.to_string())
}

pub async fn widget_veri(token: &str) -> Result<Value, String> {
    rpc("widget_veri", json!({ "p_token": token })).await
}

pub async fn bildirim_al(token: &str, son: Option<&str>) -> Result<Value, String> {
    rpc("mac_bildirim_al", json!({ "p_token": token, "p_son": son })).await
}

pub async fn arama_sil(token: &str, id: i64) -> Result<Value, String> {
    rpc("arama_sil", json!({ "p_token": token, "p_id": id })).await
}
