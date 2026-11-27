-- Sağlık widget'ı: ana ekrandan tam atak kaydı (Android atak penceresi)
-- Yalnız sağlık sahibinin cihaz anahtarıyla çalışır. ERP'deki atak formunun yaptığı her şeyi yapar:
-- atak satırı, aynı saatteki aktiviteyle eşleştirme, tansiyon girildiyse ölçüm, kriz ilacı işaretlendiyse alım (günlük sınırla).

create or replace function public._saglik_widget(u uuid)
returns json language sql stable security definer set search_path = public as $$
  with bg as (select (now() at time zone 'Europe/Istanbul')::date g),
  h as (select coalesce(nullif((veri->'hedef'->>'su'),'')::numeric, 3000) su from saglik_ayar where kullanici_id = u
        union all select 3000 limit 1),
  k as (select id, ad, coalesce(max_gunluk, 2) mx from saglik_ilac where kullanici_id = u and tur = 'gerektiginde' and aktif order by id limit 1)
  select json_build_object(
    'bugun', (select g from bg),
    'su_ml', (select coalesce(sum(case when miktar < 50 then miktar * 200 else miktar end), 0)::int
              from saglik_giris, bg where kullanici_id = u and tur = 'su' and (zaman at time zone 'Europe/Istanbul')::date = bg.g),
    'su_hedef', (select case when su < 50 then 3000 else su end::int from h),
    'atak', (select count(*) from saglik_atak, bg where kullanici_id = u and (zaman at time zone 'Europe/Istanbul')::date = bg.g),
    'nabiz', (select json_build_object('deger', deger::int, 'baglam', baglam, 'zaman', zaman) from saglik_olcum
              where kullanici_id = u and tur = 'nabiz' order by zaman desc limit 1),
    'kriz', (select json_build_object('ad', k.ad, 'max', k.mx,
               'bugun', (select count(*) from saglik_ilac_alim a, bg where a.kullanici_id = u and a.ilac_id = k.id and a.tarih = bg.g and a.dilim = 'kriz' and a.alindi))
             from k)
  )
$$;

create or replace function public.saglik_atak_ekle(p_token text, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  u uuid := _saglik_sahip_cihaz(p_token);
  z timestamptz := coalesce(nullif(p->>'zaman','')::timestamptz, now());
  g date := (coalesce(nullif(p->>'zaman','')::timestamptz, now()) at time zone 'Europe/Istanbul')::date;
  ak bigint; ki record; n int; tb int; tk int; nb int; kriz boolean := coalesce((p->>'kriz_ilac')::boolean, false);
begin
  if u is null then raise exception 'yetkisiz'; end if;
  tb := nullif(p->>'tansiyon_b','')::int; tk := nullif(p->>'tansiyon_k','')::int; nb := nullif(p->>'nabiz','')::int;
  select a.id into ak from saglik_aktivite a
   where a.kullanici_id = u and a.ikiz_id is null
     and z >= a.baslangic - interval '15 minutes'
     and z <= coalesce(a.bitis, a.baslangic + make_interval(secs => coalesce(a.sure_sn, 1800))) + interval '60 minutes'
   order by a.baslangic desc limit 1;
  if kriz then
    select id, coalesce(max_gunluk, 2) mx into ki from saglik_ilac where kullanici_id = u and tur = 'gerektiginde' and aktif order by id limit 1;
    if ki.id is null then kriz := false;
    else
      select count(*) into n from saglik_ilac_alim where kullanici_id = u and ilac_id = ki.id and tarih = g and dilim = 'kriz' and alindi;
      if n >= ki.mx then raise exception 'Kriz ilacı günlük sınırı (%) doldu', ki.mx; end if;
    end if;
  end if;
  insert into saglik_atak(kullanici_id, zaman, siddet, sure_dk, belirtiler, tetikleyiciler, durum, tansiyon_b, tansiyon_k, nabiz, iyi_gelen, kriz_ilac, aktivite_id, notu)
  values (u, z, nullif(p->>'siddet','')::int, nullif(p->>'sure_dk','')::int,
          coalesce(array(select jsonb_array_elements_text(p->'belirtiler')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p->'tetikleyiciler')), '{}'),
          nullif(p->>'durum',''), tb, tk, nb, nullif(p->>'iyi_gelen',''), kriz, ak, nullif(p->>'notu',''));
  if kriz then
    insert into saglik_ilac_alim(kullanici_id, ilac_id, tarih, dilim, alindi, zaman) values (u, ki.id, g, 'kriz', true, z);
  end if;
  if tb is not null and tk is not null then
    insert into saglik_olcum(kullanici_id, tur, deger, deger2, deger3, baglam, zaman, kaynak) values (u, 'tansiyon', tb, tk, nb, 'atak', z, 'widget');
  end if;
  return _saglik_widget(u);
end $$;

revoke all on function public._saglik_widget(uuid) from public, anon, authenticated;
grant execute on function public.saglik_atak_ekle(text, jsonb) to anon, authenticated;
