-- Also harden development databases initialized during initial implementation.
create unique index if not exists single_admin on public.admins((true));
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke execute on all functions in schema public from public;
