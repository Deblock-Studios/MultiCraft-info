/* ─────────────────────────────────────────────────────────────────
 *  banned_users — complétion du schéma + RLS
 *  Projet Supabase : rdtvftclctwfqtpkbzlf
 *
 *  Idempotent : rejouable autant de fois que nécessaire.
 *  Où l'exécuter : Supabase Dashboard → SQL Editor → New query → Run
 *
 *  VERSION SIMPLIFIÉE : chaque policy tient sur UNE seule ligne, et le
 *  contrôle admin passe par la fonction is_admin(). Si une instruction
 *  échoue, les suivantes s'exécutent quand même : relance le script.
 *
 *  OPTION C ACTIVÉE : le contrôle anti-contournement à l'inscription passe par
 *  la RPC is_email_banned(). La table n'est donc PLUS lisible avec la clé anon
 *  (section 4f commentée + revoke en section 5).
 *
 *  État constaté avant ce script (lecture seule via PostgREST) :
 *    - table accessible, 0 ligne visible en anon
 *    - colonnes présentes : user_id (type TEXT), banned_by, reason, banned_at
 *    - colonnes ABSENTES  : email
 *    - policies RLS : inconnues (non lisibles sans service_role)
 * ───────────────────────────────────────────────────────────────── */


/* ═══ 1. FONCTION is_admin (déclarée en premier, utilisée par les policies) ═══ */

create or replace function public.is_admin(p_uid text) returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles u where u.user_id::text = p_uid and u.role_id >= 3) $$;

grant execute on function public.is_admin(text) to anon, authenticated;

/* Contrôle anti-contournement par email, SANS exposer la table à la clé anon :
   retourne le motif du ban, ou NULL si l'email n'est pas banni.
   Utilisée par Deblock.signUp() avant la création du compte. */
create or replace function public.is_email_banned(p_email text) returns text
language sql stable security definer set search_path = public
as $$ select reason from public.banned_users where email = lower(btrim(p_email)) limit 1 $$;

grant execute on function public.is_email_banned(text) to anon, authenticated;


/* ═══ 2. TABLE + COLONNES ═══════════════════════════════════════ */

-- Ignoré si la table existe déjà (tes données ne sont pas touchées)
create table if not exists public.banned_users (
  user_id   text primary key,           -- auth.users.id (uuid stocké en texte)
  banned_by text,                       -- id de l'admin qui a posé le ban
  reason    text,                       -- motif affiché au bannisseur
  banned_at timestamptz not null default now(),
  email     text                        -- sert au blocage d'inscription
);

alter table public.banned_users add column if not exists user_id   text;
alter table public.banned_users add column if not exists banned_by text;
alter table public.banned_users add column if not exists reason    text;
alter table public.banned_users add column if not exists banned_at timestamptz;
alter table public.banned_users add column if not exists email     text;

alter table public.banned_users alter column banned_at set default now();


/* ═══ 3. NETTOYAGE + INDEX ══════════════════════════════════════ */

update public.banned_users set email = lower(btrim(email)) where email is not null and email <> lower(btrim(email));
update public.banned_users set banned_at = now() where banned_at is null;

-- Index simples (jamais d'index unique : il ferait échouer le script si des
-- doublons existent déjà, et le code n'en a pas besoin)
create index if not exists banned_users_user_id_idx on public.banned_users (user_id);
create index if not exists banned_users_email_idx  on public.banned_users (email);

-- Email toujours en minuscules : garanti par la contrainte, sans trigger
alter table public.banned_users drop constraint if exists banned_users_email_lower;
alter table public.banned_users add constraint banned_users_email_lower check (email is null or email = lower(btrim(email)));


/* ═══ 4. ROW LEVEL SECURITY ═════════════════════════════════════ */

-- ⚠️ Si la RLS était désactivée, la clé anon pouvait insérer n'importe quel ban.
--    L'activer est ce qui rend les policies ci-dessous effectives.
alter table public.banned_users enable row level security;

-- 4a. Lecture de SON propre ban.
--     Indispensable : sans elle, un utilisateur banni ne voit rien (RLS renvoie 0
--     ligne), le code retombe en « fail-open » et le ban n'est jamais bloqué au login.
drop policy if exists "banned_users read own" on public.banned_users;
create policy "banned_users read own" on public.banned_users for select to authenticated using (user_id::text = auth.uid()::text);

-- 4b. Lecture de tous les bans (admin) : bouton ban/unban du chat, futur panneau
drop policy if exists "banned_users admin read" on public.banned_users;
create policy "banned_users admin read" on public.banned_users for select to authenticated using (public.is_admin(auth.uid()::text));

-- 4c. Poser un ban : admin/owner (role_id 3 ou 4), et banned_by = auteur réel
drop policy if exists "banned_users admin insert" on public.banned_users;
create policy "banned_users admin insert" on public.banned_users for insert to authenticated with check (public.is_admin(auth.uid()::text) and banned_by::text = auth.uid()::text);

-- 4d. Retirer un ban (débannissement)
drop policy if exists "banned_users admin delete" on public.banned_users;
create policy "banned_users admin delete" on public.banned_users for delete to authenticated using (public.is_admin(auth.uid()::text));

-- 4e. Modifier un ban (changement de motif)
drop policy if exists "banned_users admin update" on public.banned_users;
create policy "banned_users admin update" on public.banned_users for update to authenticated using (public.is_admin(auth.uid()::text)) with check (public.is_admin(auth.uid()::text));

-- 4f. Contrôle anti-contournement à l'inscription : DÉSACTIVÉ (option C).
--     Le code appelle la RPC is_email_banned() au lieu de lire la table, donc
--     aucune policy n'est nécessaire pour `anon` — et la liste des emails bannis
--     reste privée. Pour revenir à l'approche REST (lecture directe), décommente
--     les 2 lignes ci-dessous, remets le `grant select ... to anon` en section 5,
--     et remets fetchBanRecord('email=eq.…') dans deblock-auth.js.
-- drop policy if exists "banned_users anon email" on public.banned_users;
-- create policy "banned_users anon email" on public.banned_users for select to anon, authenticated using (email is not null);


/* ═══ 5. DROITS (nécessaires en plus de la RLS) ═════════════════ */

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.banned_users to authenticated;

-- Option C : la clé anon n'a plus aucun droit sur la table.
-- ⚠️ Ce `revoke` est INDISPENSABLE : les privilèges par défaut de Supabase
--    accordent déjà SELECT à anon, donc retirer la policy 4f ne suffit pas.
--    Sans lui, la liste des emails bannis resterait lisible publiquement.
--    On retire aussi les droits d'écriture : un visiteur non connecté n'a rien
--    à écrire dans cette table (cf. sql/security_lockdown.sql).
revoke select, insert, update, delete on public.banned_users from anon;


/* ═══ OPTIONS (décommente si besoin) ════════════════════════════ */

/* A. Bans temporaires — le code les ignore tant qu'il n'est pas adapté
-- alter table public.banned_users add column if not exists banned_until timestamptz;
*/

/* B. Clé étrangère vers auth.users — impossible aujourd'hui : user_id est en TEXT
      alors que auth.users.id est un uuid. À tenter seulement si la table est vide,
      et dans ce cas retirer les ::text de la policy 4a.
-- alter table public.banned_users alter column user_id  type uuid using user_id::uuid;
-- alter table public.banned_users alter column banned_by type uuid using banned_by::uuid;
-- alter table public.banned_users add constraint banned_users_user_fk foreign key (user_id) references auth.users(id) on delete cascade;
*/

/* C. ✓ DÉJÀ APPLIQUÉ : la fonction public.is_email_banned est créée en section 1
      et la policy 4f est neutralisée. Rien à décommenter ici. */


/* ═══ VÉRIFICATION (à relancer après exécution) ════════════════ */

select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = 'banned_users';
select policyname, cmd, roles::text from pg_policies where tablename = 'banned_users' order by policyname;
select column_name, data_type, is_nullable from information_schema.columns where table_name = 'banned_users' order by ordinal_position;

-- Test is_admin (remplace <uuid-par-un-admin> pour vérifier) :
-- select public.is_admin('<uuid-par-un-admin>'::text);

-- Test du contrôle anti-contournement (doit renvoyer le motif, ou NULL) :
-- select public.is_email_banned('email@exemple.com');

-- Sanction manuelle (exemple, à adapter) :
-- insert into public.banned_users (user_id, banned_by, reason, banned_at, email)
-- values ('<uuid-utilisateur>', '<uuid-admin>', 'Harcèlement répété', now(), 'email@exemple.com');