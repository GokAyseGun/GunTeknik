-- Sağlık: widget (Android + Mac) için su / nabız / atak sayısı
-- Yalnız sağlık sahibinin (erp_ayarlar 'saglik'.sahip) cihaz anahtarı ile çalışır; diğer ERP üyelerinin
-- widget'ına sağlık verisi hiç gitmez. Su: miktar ml; 50'den küçük eski kayıtlar bardak sayılır (×200 ml).

create or replace function public._saglik_sahip_cihaz(p_token text)
returns uuid language sql stable security definer set search_path = public as $$
  select c.kullanici from cihazlar c
  where p_token is not null and c.token = p_token
    and c.kullanici = coalesce((select (deger->>'sahip')::uuid from erp_ayarlar where anahtar = 'saglik'),
                               (select (deger->>'sahip')::uuid from erp_ayarlar where anahtar = 'checkin'))
  limit 1
$$;

create or replace function public._saglik_widget(u uuid)
returns json language sql stable security definer set search_path = public as $$
  with bg as (select (now() at time zone 'Europe/Istanbul')::date g),
  h as (select coalesce(nullif((veri->'hedef'->>'su'),'')::numeric, 3000) su from saglik_ayar where kullanici_id = u
        union all select 3000 limit 1)
  select json_build_object(
    'bugun', (select g from bg),
    'su_ml', (select coalesce(sum(case when miktar < 50 then miktar * 200 else miktar end), 0)::int
              from saglik_giris, bg where kullanici_id = u and tur = 'su' and (zaman at time zone 'Europe/Istanbul')::date = bg.g),
    'su_hedef', (select case when su < 50 then 3000 else su end::int from h),
    'atak', (select count(*) from saglik_atak, bg where kullanici_id = u and (zaman at time zone 'Europe/Istanbul')::date = bg.g),
    'nabiz', (select json_build_object('deger', deger::int, 'baglam', baglam, 'zaman', zaman) from saglik_olcum
              where kullanici_id = u and tur = 'nabiz' order by zaman desc limit 1)
  )
$$;

create or replace function public.saglik_su_ekle(p_token text, p_ml int default 200)
returns json language plpgsql security definer set search_path = public as $$
declare u uuid := _saglik_sahip_cihaz(p_token);
begin
  if u is null then raise exception 'yetkisiz'; end if;
  if p_ml is null or p_ml < 50 or p_ml > 2000 then raise exception 'miktar'; end if;
  insert into saglik_giris(kullanici_id, tur, miktar, kaynak) values (u, 'su', p_ml, 'widget');
  return _saglik_widget(u);
end $$;

create or replace function public.saglik_nabiz_ekle(p_token text, p_deger int, p_baglam text)
returns json language plpgsql security definer set search_path = public as $$
declare u uuid := _saglik_sahip_cihaz(p_token);
begin
  if u is null then raise exception 'yetkisiz'; end if;
  if p_deger is null or p_deger < 30 or p_deger > 230 then raise exception 'deger'; end if;
  if p_baglam not in ('dinlenme','gunluk','hafif','agir','atak') then raise exception 'baglam'; end if;
  insert into saglik_olcum(kullanici_id, tur, deger, baglam, kaynak) values (u, 'nabiz', p_deger, p_baglam, 'widget');
  if p_baglam = 'atak' then
    update saglik_atak set nabiz = p_deger
    where id = (select id from saglik_atak where kullanici_id = u and nabiz is null and zaman > now() - interval '1 hour'
                and zaman <= now() + interval '5 minutes' order by zaman desc limit 1);
  end if;
  return _saglik_widget(u);
end $$;

revoke all on function public._saglik_sahip_cihaz(text) from public, anon, authenticated;
revoke all on function public._saglik_widget(uuid) from public, anon, authenticated;
grant execute on function public.saglik_su_ekle(text, int) to anon, authenticated;
grant execute on function public.saglik_nabiz_ekle(text, int, text) to anon, authenticated;

-- widget_veri: mevcut fonksiyonun aynısı + 'saglik' anahtarı (yalnız sağlık sahibinin cihazında dolu)
CREATE OR REPLACE FUNCTION public.widget_veri(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bg date := (now() at time zone 'Europe/Istanbul')::date; r json; su uuid := _saglik_sahip_cihaz(p_token);
begin
  if not _cihaz_yetki(p_token) then raise exception 'yetkisiz'; end if;
  if p_token is not null then update cihazlar set son_gorulme=now() where token=p_token; end if;
  select json_build_object(
    'zaman', now(), 'bugun', bg,
    'snap', w.veri, 'snap_zaman', w.veri_zaman,
    'saglik', case when su is not null then _saglik_widget(su) end,
    'gt', json_build_object('fiyat', (select fiyat from bet_gt_fiyat order by zaman desc, id desc limit 1),
      'once', (select fiyat from bet_gt_fiyat where zaman <= now() - interval '24 hours' order by zaman desc, id desc limit 1)),
    'arama', json_build_object(
      'reklam', (select coalesce(sum(deger),0)::int from reklam_manuel where tip='ads_arama' and tarih=bg),
      'yok', exists(select 1 from reklam_manuel where tip='ads_arama_yok' and tarih=bg),
      'dun', (select coalesce(sum(deger),0)::int from reklam_manuel where tip='ads_arama' and tarih=bg-1),
      'ay', (select coalesce(sum(deger),0)::int from reklam_manuel where tip='ads_arama' and tarih>=date_trunc('month',bg)::date),
      'toplam', (select count(*) from arama_takip where tarih=bg),
      'tel', (select coalesce(sum(deger),0)::int from reklam_manuel where tip='ads_arama' and tarih=bg and coalesce(kanal,'tel')<>'wa'),
      'wa', (select coalesce(sum(deger),0)::int from reklam_manuel where tip='ads_arama' and tarih=bg and kanal='wa'),
      'sektor', coalesce((select json_object_agg(s,n) from (select coalesce(nullif(sektor,''),'Diğer') s, sum(deger)::int n from reklam_manuel where tip='ads_arama' and tarih=bg group by 1) z),'{}'::json),
      'takip', (select count(*) from arama_takip where sonuc='potansiyel'),
      'tum_sektor', coalesce((select json_object_agg(s,n) from (select coalesce(nullif(sektor,''),'Belli değil') s, count(*)::int n from arama_takip where tarih=bg group by 1) z),'{}'::json),
      'kaynak', coalesce((select json_object_agg(s,n) from (select coalesce(nullif(kaynak,''),'Bilinmiyor') s, count(*)::int n from arama_takip where tarih=bg group by 1) z),'{}'::json),
      'son', coalesce((select json_agg(x) from (select id, zaman, coalesce(nullif(rehber_ad,''),numara,'Elle kayıt') ad, kaynak, sektor, sonuc, kanal from arama_takip order by zaman desc limit 5) x),'[]'::json)
    )) into r
  from widget_durum w where w.id=1;
  return r;
end $function$;
