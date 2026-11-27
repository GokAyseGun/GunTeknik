-- Sağlık widget'ı: butonların altında o günün kayıtları (atak saat/şiddet, nabız saat/değer/an, su adet/son saat)
create or replace function public._saglik_widget(u uuid)
returns json language sql stable security definer set search_path = public as $$
  with bg as (select (now() at time zone 'Europe/Istanbul')::date g),
  h as (select coalesce(nullif((veri->'hedef'->>'su'),'')::numeric, 3000) su from saglik_ayar where kullanici_id = u
        union all select 3000 limit 1),
  k as (select id, ad, coalesce(max_gunluk, 2) mx from saglik_ilac where kullanici_id = u and tur = 'gerektiginde' and aktif order by id limit 1),
  su as (select * from saglik_giris, bg where kullanici_id = u and tur = 'su' and (zaman at time zone 'Europe/Istanbul')::date = bg.g),
  at as (select * from saglik_atak, bg where kullanici_id = u and (zaman at time zone 'Europe/Istanbul')::date = bg.g),
  nb as (select * from saglik_olcum, bg where kullanici_id = u and tur = 'nabiz' and (zaman at time zone 'Europe/Istanbul')::date = bg.g)
  select json_build_object(
    'bugun', (select g from bg),
    'su_ml', (select coalesce(sum(case when miktar < 50 then miktar * 200 else miktar end), 0)::int from su),
    'su_adet', (select count(*) from su),
    'su_son', (select to_char(max(zaman) at time zone 'Europe/Istanbul', 'HH24:MI') from su),
    'su_hedef', (select case when su < 50 then 3000 else su end::int from h),
    'atak', (select count(*) from at),
    'atak_liste', coalesce((select json_agg(x) from (select to_char(zaman at time zone 'Europe/Istanbul', 'HH24:MI') saat, siddet, kriz_ilac kriz
                  from at order by zaman desc limit 6) x), '[]'::json),
    'nabiz', (select json_build_object('deger', deger::int, 'baglam', baglam, 'zaman', zaman) from saglik_olcum
              where kullanici_id = u and tur = 'nabiz' order by zaman desc limit 1),
    'nabiz_liste', coalesce((select json_agg(x) from (select to_char(zaman at time zone 'Europe/Istanbul', 'HH24:MI') saat, deger::int deger, baglam
                  from nb order by zaman desc limit 6) x), '[]'::json),
    'kriz', (select json_build_object('ad', k.ad, 'max', k.mx,
               'bugun', (select count(*) from saglik_ilac_alim a, bg where a.kullanici_id = u and a.ilac_id = k.id and a.tarih = bg.g and a.dilim = 'kriz' and a.alindi))
             from k)
  )
$$;
revoke all on function public._saglik_widget(uuid) from public, anon, authenticated;
