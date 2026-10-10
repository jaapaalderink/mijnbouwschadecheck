create table public.admins(user_id uuid primary key default gen_random_uuid(),email text unique not null,password_hash text not null,totp_secret text);
create unique index single_admin on public.admins((true));
create table public.sessions(token_hash text primary key,user_id uuid not null references public.admins(user_id) on delete cascade,expires_at timestamptz not null);
create table public.password_resets(token_hash text primary key,user_id uuid not null references public.admins(user_id) on delete cascade,expires_at timestamptz not null);
create table public.questionnaire_versions(id uuid primary key,version integer unique not null,definition jsonb not null,state text not null check(state in ('draft','published','archived')),created_at timestamptz not null default now());
create unique index one_active_questionnaire on public.questionnaire_versions((state)) where state='published';
create sequence public.application_number;
create table public.applications(id uuid primary key default gen_random_uuid(),number bigint unique not null default nextval('public.application_number'),created_at timestamptz not null default now(),idempotency_key uuid unique not null,payload_hash text not null,version_id uuid not null references public.questionnaire_versions(id),questionnaire_snapshot jsonb not null,contact jsonb not null,address jsonb not null,answers jsonb not null,indication text not null check(indication in ('possible','review_needed')),reasons jsonb not null,status text not null default 'Nieuw' check(status in ('Nieuw','In behandeling','Afgerond')),review_status text not null default 'Nog te controleren' check(review_status in ('Nog te controleren','Gecontroleerd')),reviewed_at timestamptz,reviewed_by uuid references public.admins(user_id),note text not null default '',search_text text not null,check((review_status='Gecontroleerd' and reviewed_at is not null and reviewed_by is not null) or (review_status='Nog te controleren' and reviewed_at is null and reviewed_by is null)));
create table public.notification_outbox(id uuid primary key default gen_random_uuid(),application_id uuid unique not null references public.applications(id) on delete cascade,status text not null default 'pending' check(status in ('pending','sending','delivered','failed')),attempts integer not null default 0,next_attempt_at timestamptz not null default now(),delivered_at timestamptz);
create table public.application_audit(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications(id) on delete cascade,actor uuid not null references public.admins(user_id),created_at timestamptz not null default now(),changes jsonb not null);
create function public.submit_application(p_key uuid,p_hash text,p_version uuid,p_definition jsonb,p_contact jsonb,p_address jsonb,p_answers jsonb,p_indication text,p_reasons jsonb,p_search text) returns jsonb language plpgsql set search_path=public as $$
declare a public.applications;
begin
perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
select * into a from public.applications where idempotency_key=p_key;
if found then if a.payload_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return jsonb_build_object('number',a.number,'indication',a.indication); end if;
if not exists(select 1 from public.questionnaire_versions where id=p_version and state in ('published','archived')) then raise exception 'INVALID_VERSION'; end if;
insert into public.applications(idempotency_key,payload_hash,version_id,questionnaire_snapshot,contact,address,answers,indication,reasons,search_text) values(p_key,p_hash,p_version,p_definition,p_contact,p_address,p_answers,p_indication,p_reasons,p_search) returning * into a;
insert into public.notification_outbox(application_id) values(a.id);
return jsonb_build_object('number',a.number,'indication',a.indication);
end $$;
create function public.publish_questionnaire(p_id uuid,p_definition jsonb) returns jsonb language plpgsql set search_path=public as $$
declare v integer;
begin
perform pg_advisory_xact_lock(752103);
if not exists(select 1 from public.questionnaire_versions where id=p_id and state='draft') then raise exception 'NOT_DRAFT'; end if;
select coalesce(max(version),0)+1 into v from public.questionnaire_versions where state<>'draft';
update public.questionnaire_versions set state='archived' where state='published';
update public.questionnaire_versions set state='published',version=v,definition=jsonb_set(p_definition,'{version}',to_jsonb(v)) where id=p_id;
return jsonb_build_object('version',v);
end $$;
create function public.save_questionnaire_draft(p_id uuid,p_definition jsonb) returns void language plpgsql set search_path=public as $$
begin
perform pg_advisory_xact_lock(752103);
if exists(select 1 from public.questionnaire_versions where id=p_id and state<>'draft') then raise exception 'IMMUTABLE_VERSION'; end if;
insert into public.questionnaire_versions(id,version,definition,state) values(p_id,coalesce((select min(version)-1 from public.questionnaire_versions where state='draft'),-1),p_definition,'draft') on conflict(id) do update set definition=excluded.definition;
end $$;
create function public.update_application(p_id uuid,p_actor uuid,p_status text,p_review text,p_note text) returns void language plpgsql set search_path=public as $$
declare a public.applications; changes jsonb;
begin
if not exists(select 1 from public.admins where user_id=p_actor) then raise exception 'FORBIDDEN'; end if;
select * into a from public.applications where id=p_id for update;
if not found then raise exception 'NOT_FOUND'; end if;
changes=jsonb_build_object('status',jsonb_build_array(a.status,p_status),'review_status',jsonb_build_array(a.review_status,p_review),'note_changed',a.note<>p_note);
update public.applications set status=p_status,review_status=p_review,note=p_note,reviewed_at=case when p_review='Gecontroleerd' then coalesce(a.reviewed_at,now()) else null end,reviewed_by=case when p_review='Gecontroleerd' then coalesce(a.reviewed_by,p_actor) else null end where id=p_id;
insert into public.application_audit(application_id,actor,changes) values(p_id,p_actor,changes);
end $$;
create function public.claim_notifications() returns table(id uuid,application_id uuid,attempts integer) language sql set search_path=public as $$
update public.notification_outbox set status='sending',attempts=notification_outbox.attempts+1,next_attempt_at=now()+interval '5 minutes' where notification_outbox.id in (select o.id from public.notification_outbox o where o.attempts<5 and ((o.status='pending' and o.next_attempt_at<=now()) or (o.status='sending' and o.next_attempt_at<=now())) order by o.next_attempt_at for update skip locked limit 10) returning notification_outbox.id,notification_outbox.application_id,notification_outbox.attempts;
$$;

-- PostgreSQL is private; the browser has no database identity or direct access.
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke execute on all functions in schema public from public;
