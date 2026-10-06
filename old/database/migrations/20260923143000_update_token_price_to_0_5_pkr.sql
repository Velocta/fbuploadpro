-- Migration: Update token price from 0.15 PKR to 0.50 PKR
-- Description: Sets the default token_price_pkr to 0.50 and updates existing system_settings record.

alter table public.system_settings
  alter column token_price_pkr set default 0.50;

update public.system_settings
set token_price_pkr = 0.50
where id = 1;
