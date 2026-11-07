-- GDA Moto: criação de corrida com preço calculado pela Edge Function.
-- Execute este arquivo no Supabase SQL Editor antes de publicar a função request-ride.

create or replace function public.request_ride_from_edge(
  p_passenger_id uuid,
  p_pickup_latitude double precision,
  p_pickup_longitude double precision,
  p_destination_latitude double precision,
  p_destination_longitude double precision,
  p_payment_method text,
  p_distance_km numeric,
  p_estimated_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ride_id uuid;
begin
  if p_passenger_id is null then
    raise exception 'Passageiro inválido.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_passenger_id and role = 'passenger'
  ) then
    raise exception 'Este perfil não está habilitado como passageiro.';
  end if;

  if p_pickup_latitude not between -90 and 90
     or p_pickup_longitude not between -180 and 180
     or p_destination_latitude not between -90 and 90
     or p_destination_longitude not between -180 and 180 then
    raise exception 'Localização inválida.';
  end if;

  if p_payment_method not in ('cash', 'pix', 'card') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if p_distance_km is null or p_distance_km <= 0
     or p_estimated_price is null
     or p_estimated_price <> greatest(7.00, round(p_distance_km * 2.50, 2)) then
    raise exception 'Distância ou preço inválido.';
  end if;

  -- Serializa solicitações simultâneas do mesmo passageiro.
  perform pg_advisory_xact_lock(hashtextextended(p_passenger_id::text, 0));

  if exists (
    select 1 from public.rides
    where passenger_id = p_passenger_id
      and status in ('requested', 'accepted', 'in_progress')
  ) then
    raise exception 'Você já possui uma corrida em andamento.';
  end if;

  insert into public.rides (
    passenger_id, pickup_latitude, pickup_longitude,
    destination_latitude, destination_longitude,
    estimated_price, commission, payment_method, status
  ) values (
    p_passenger_id, p_pickup_latitude, p_pickup_longitude,
    p_destination_latitude, p_destination_longitude,
    p_estimated_price, null, p_payment_method, 'requested'
  )
  returning id into v_ride_id;

  return v_ride_id;
end;
$$;

revoke all on function public.request_ride_from_edge(
  uuid, double precision, double precision, double precision, double precision, text, numeric, numeric
) from public, anon, authenticated;

grant execute on function public.request_ride_from_edge(
  uuid, double precision, double precision, double precision, double precision, text, numeric, numeric
) to service_role;

-- Desativa a RPC antiga, que criava corridas sem preço calculado.
revoke all on function public.request_ride(
  double precision, double precision, double precision, double precision, text
) from public, anon, authenticated;
