-- Strava bağlantısı (Sağlık sayfası). Yalnız şema; anahtarlar/jetonlar burada YOK (depo herkese açık).
-- Üç tablo da yalnız sunucu (Edge Function, service role) içindir: politika yok, anon/authenticated erişemez.
create table if not exists public.saglik_strava (
  kullanici_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id bigint,
  ad text,
  refresh_token text,
  access_token text,
  son_kullanma timestamptz,
  kapsam text,
  son_cekim timestamptz,
  durum text,
  guncellendi timestamptz not null default now()
);
create table if not exists public.saglik_strava_durum (
  durum text primary key,
  kullanici uuid not null,
  olusturma timestamptz not null default now()
);
create table if not exists public.saglik_gizli (
  anahtar text primary key,
  deger text not null,
  guncellendi timestamptz not null default now()
);
alter table public.saglik_strava enable row level security;
alter table public.saglik_strava_durum enable row level security;
alter table public.saglik_gizli enable row level security;
revoke all on public.saglik_strava, public.saglik_strava_durum, public.saglik_gizli from anon, authenticated;

select 'Tamam: Strava tabloları hazır' as sonuc;
