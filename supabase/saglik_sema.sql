-- Sağlık modülü şeması (yalnız şema; veri burada YOK — depo herkese açık).
-- Her tablo "sadece sahibi" kurallı: satırı yalnız kendi kullanici_id'si olan oturum görür/yazar.

create table if not exists public.saglik_ayar (
  kullanici_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  veri jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.saglik_olcum (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  tur text not null check (tur in ('kilo','bel','tansiyon','nabiz','yag','kas','glukoz','spo2','ates')),
  deger numeric not null,
  deger2 numeric,          -- tansiyon: küçük
  deger3 numeric,          -- tansiyon: nabız
  baglam text,             -- sabah | aksam | atak | ac | tok | spor
  kaynak text not null default 'elle',
  dis_id text,
  notu text,
  created_at timestamptz not null default now()
);
create index if not exists saglik_olcum_k_z on public.saglik_olcum(kullanici_id, tur, zaman);
create unique index if not exists saglik_olcum_dis on public.saglik_olcum(kullanici_id, dis_id) where dis_id is not null;

create table if not exists public.saglik_gunluk (
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarih date not null,
  adim int, mesafe_m numeric, aktif_kcal numeric, toplam_kcal numeric, kat int,
  uyku_dk int, uyku_derin_dk int, uyku_rem_dk int, uyku_hafif_dk int, uyku_uyanik_dk int,
  uyku_bas timestamptz, uyku_bit timestamptz,
  nabiz_dinlenik int, nabiz_min int, nabiz_max int, nabiz_ort int,
  spo2 numeric, stres int,
  kcal_alinan numeric, protein_g numeric, karb_g numeric, yag_g numeric, lif_g numeric, seker_g numeric,
  kaynak text not null default 'elle',
  guncelleme timestamptz not null default now(),
  primary key (kullanici_id, tarih)
);

create table if not exists public.saglik_aktivite (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  baslangic timestamptz not null,
  bitis timestamptz,
  tur text not null default 'yuruyus',  -- yuruyus | kosu | bisiklet | trekking | ev | diger
  ad text,
  sure_sn int, hareket_sn int, mesafe_m numeric, kcal numeric, irtifa_m numeric,
  nabiz_ort int, nabiz_max int, hiz_ort numeric, hiz_max numeric,
  rota text,               -- kodlanmış polyline
  akis jsonb,              -- {mesafe:[], irtifa:[], nabiz:[], zaman:[]}
  hareketler jsonb,        -- ev antrenmanı: [{ad,set,tekrar,kg,sure_sn}]
  kaynak text not null default 'elle',  -- elle | strava | hc
  dis_id text,
  ikiz_id bigint,          -- aynı aktivitenin başka kaynaktan gelen kopyası (çift sayılmaz)
  notu text,
  created_at timestamptz not null default now()
);
create index if not exists saglik_aktivite_k_z on public.saglik_aktivite(kullanici_id, baslangic);
create unique index if not exists saglik_aktivite_dis on public.saglik_aktivite(kullanici_id, kaynak, dis_id) where dis_id is not null;

create table if not exists public.saglik_atak (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  siddet int check (siddet between 1 and 10),
  sure_dk int,
  belirtiler text[] not null default '{}',
  tetikleyiciler text[] not null default '{}',
  durum text,              -- dinlenirken | is | spor | yemek | uyku | sohbet | araba | diger
  tansiyon_b int, tansiyon_k int, nabiz int,
  iyi_gelen text,
  kriz_ilac boolean not null default false,
  aktivite_id bigint references public.saglik_aktivite(id) on delete set null,
  notu text,
  created_at timestamptz not null default now()
);
create index if not exists saglik_atak_k_z on public.saglik_atak(kullanici_id, zaman);

create table if not exists public.saglik_ilac (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ad text not null,
  doz text,
  etken text,
  tur text not null default 'duzenli' check (tur in ('duzenli','gerektiginde','takviye')),
  zamanlar text[] not null default '{}',   -- sabah | ogle | aksam
  max_gunluk int,
  baslangic date, bitis date,
  aktif boolean not null default true,
  sira int not null default 0,
  renk text,
  notu text,
  created_at timestamptz not null default now()
);

create table if not exists public.saglik_ilac_alim (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ilac_id bigint references public.saglik_ilac(id) on delete cascade,
  tarih date not null,
  dilim text not null,     -- sabah | ogle | aksam | kriz
  alindi boolean not null default true,
  zaman timestamptz not null default now(),
  secim text,              -- takviye: o gün ne alındı (balık yağı, D vitamini…)
  notu text
);
create unique index if not exists saglik_ilac_alim_tek on public.saglik_ilac_alim(kullanici_id, ilac_id, tarih, dilim) where dilim <> 'kriz';
create index if not exists saglik_ilac_alim_k_t on public.saglik_ilac_alim(kullanici_id, tarih);

create table if not exists public.saglik_tahlil (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarih date not null,
  grup text,
  test text not null,
  deger numeric,
  deger_metin text,
  birim text,
  ref_alt numeric, ref_ust numeric, ref_metin text,
  hedef numeric,
  isaret text,             -- yuksek | dusuk | sinir | normal
  lab text,
  notu text,
  kaynak text not null default 'claude',
  created_at timestamptz not null default now(),
  unique (kullanici_id, tarih, test)
);

create table if not exists public.saglik_randevu (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tur text not null default 'randevu' check (tur in ('randevu','tetkik','soru')),
  baslik text not null,
  brans text,
  tarih date, saat time,
  yer text,
  durum text not null default 'bekliyor' check (durum in ('bekliyor','yapildi','iptal')),
  oncelik int not null default 2,
  notu text,
  sira int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.saglik_giris (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  tur text not null check (tur in ('su','kafein','ogun','sigara')),
  miktar numeric not null default 1,   -- su: bardak (≈250 ml) · kafein: fincan · öğün: kcal
  alt text,                -- kafein: americano/turk/filtre/cay/enerji · öğün: kahvalti/ogle/aksam/ara
  ac boolean,              -- kafein aç karnına mı
  notu text,
  kaynak text not null default 'elle',
  dis_id text
);
create index if not exists saglik_giris_k_z on public.saglik_giris(kullanici_id, tur, zaman);

create table if not exists public.saglik_sabah (
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tarih date not null,
  uyku_kalite int check (uyku_kalite between 1 and 10),
  uyku_saat numeric,
  uyanis int check (uyanis between 1 and 5),
  gece_atak boolean,
  kahvalti boolean,
  kahvalti_ne text,
  kahve_ac int, kahve_tok int,
  kilo numeric,
  tansiyon_b int, tansiyon_k int, nabiz int,
  notu text,
  kacirildi boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (kullanici_id, tarih)
);

create table if not exists public.saglik_claude (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  zaman timestamptz not null default now(),
  tur text not null default 'analiz' check (tur in ('analiz','haftalik','aylik','soru','cevap','not')),
  konu text,               -- genel | atak | kilo | tahlil | ilac | uyku | aktivite | beslenme | tansiyon
  baslik text,
  ozet text,
  metin text,
  soru_id bigint references public.saglik_claude(id) on delete set null,
  durum text not null default 'yeni',   -- soru: bekliyor | cevaplandi · diğer: yeni | okundu
  created_at timestamptz not null default now()
);
create index if not exists saglik_claude_k_z on public.saglik_claude(kullanici_id, zaman);

do $$
declare t text;
begin
  foreach t in array array['saglik_ayar','saglik_olcum','saglik_gunluk','saglik_aktivite','saglik_atak','saglik_ilac',
    'saglik_ilac_alim','saglik_tahlil','saglik_randevu','saglik_giris','saglik_sabah','saglik_claude'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists sadece_sahibi on public.%I', t);
    execute format('create policy sadece_sahibi on public.%I for all to authenticated using (kullanici_id = (select auth.uid())) with check (kullanici_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
