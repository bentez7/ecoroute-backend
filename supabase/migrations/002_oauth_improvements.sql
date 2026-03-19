-- Add auth_provider column
alter table public.users add column if not exists auth_provider text not null default 'email';

-- Fix handle_new_user trigger to support OAuth providers
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'provider', 'email')
  );
  return new;
end;
$$ language plpgsql security definer;
