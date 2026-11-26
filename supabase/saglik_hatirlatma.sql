-- Sağlık hatırlatmaları: ERP açıkken sağlık sayfası ileriye dönük bildirimleri planlar
-- (ilaç saati, yemek sonrası yürüyüş, randevu). Yalnız sağlık sayfasının sahibi çağırabilir,
-- bildirim yalnız ona gider (hedef). Kişisel veri içermez; içerik istemciden gelir.
create or replace function public.saglik_push_planla(p jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n int; sahip uuid;
begin
  sahip := (select (deger->>'sahip')::uuid from erp_ayarlar where anahtar = 'saglik');
  if auth.uid() is null or sahip is null or auth.uid() <> sahip then raise exception 'yetki yok'; end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 60 then raise exception 'geçersiz plan'; end if;
  delete from push_kuyruk q where q.kaynak = 'saglik-plan' and q.gonderildi is null
    and not exists (select 1 from jsonb_array_elements(p) x where 'saglik:' || (x->>'anahtar') = q.anahtar);
  insert into push_kuyruk(anahtar, zaman, baslik, govde, url, kaynak, oncelik, hedef)
  select 'saglik:' || (x->>'anahtar'), (x->>'zaman')::timestamptz, left(x->>'baslik', 120), left(x->>'govde', 300),
         coalesce(x->>'url', './'), 'saglik-plan', 5, sahip
  from jsonb_array_elements(p) x
  where (x->>'zaman')::timestamptz > now() - interval '5 minutes'
    and (x->>'zaman')::timestamptz < now() + interval '8 days'
  on conflict (anahtar) do update set zaman = excluded.zaman, baslik = excluded.baslik, govde = excluded.govde, url = excluded.url
    where push_kuyruk.gonderildi is null;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.saglik_push_planla(jsonb) from public, anon;
grant execute on function public.saglik_push_planla(jsonb) to authenticated;

select 'Tamam: sağlık hatırlatmaları hazır' as sonuc;
