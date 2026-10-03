/* ─────────────────────────────────────────────────────────────────
 *  OPTION C — contrôle anti-contournement par email SANS exposer
 *  la table banned_users à la clé anon.
 *
 *  À exécuter dans : Supabase Dashboard → SQL Editor
 *  Idempotent : rejouable sans risque.
 *
 *  ⚠️ Prérequis : le code du site doit appeler la RPC
 *     fetchEmailBan() dans deblock-auth.js (déjà fait dans les deux clones).
 *     Si tu n'exécutes QUE ce script, l'inscription n'est pas encore bloquée :
 *     c'est la version REST (policy "banned_users anon email") qui est désactivée
 *     en section 3, et le code n'utilise plus cette voie.
 *
 *  Ordre d'exécution : 1) exécution du script principal (RLS + policies)
 *                       2) celui-ci
 *                       3) déploiement du site
 * ───────────────────────────────────────────────────────────────── */


/* ── 1. La colonne email (nécessaire avant de créer la fonction) ── */

alter table public.banned_users add column if not exists email text;

-- Normalisation : indispensable, sinon la contrainte échoue sur des données existantes
update public.banned_users set email = lower(btrim(email)) where email is not null and email <> lower(btrim(email));

-- Garantit des emails en minuscules sans trigger (le code envoie déjà en minuscules)
alter table public.banned_users drop constraint if exists banned_users_email_lower;
alter table public.banned_users add constraint banned_users_email_lower check (email is null or email = lower(btrim(email)));

create index if not exists banned_users_email_idx on public.banned_users (email);


/* ── 2. La fonction : renvoie le motif d'un email testé, ou NULL ── */

-- security definer : elle s'exécute avec les droits du propriétaire de la table,
-- donc elle fonctionne même après le `revoke` ci-dessous (contrairement à un
-- simple SELECT). Elle ne retourne QUE l'email demandé → aucune fuite de liste.
create or replace function public.is_email_banned(p_email text) returns text
language sql stable security definer set search_path = public
as $$ select reason from public.banned_users where email = lower(btrim(p_email)) limit 1 $$;

grant execute on function public.is_email_banned(text) to anon, authenticated;


/* ── 3. Fermeture de l'accès direct en lecture ── */

-- Retrait de la policy qui autorisait l'email à lire la table (approche REST)
drop policy if exists "banned_users anon email" on public.banned_users;

-- ⚠️ INDISPENSABLE : les privilèges par défaut de Supabase accordent déjà
--    SELECT à anon. Supprimer la policy ne suffit donc pas — sans ce revoke,
--    la liste complète des emails bannis resterait lisible publiquement.
revoke select, insert, update, delete on public.banned_users from anon;

-- Les utilisateurs connectés continuent de lire leur propre ban et les admins
-- la table entière : on vérifie qu'on n'a pas trop serré.
-- select policyname, cmd from pg_policies where tablename = 'banned_users' order by 1;


/* ── 4. Vérification ── */

-- Doit renvoyer le motif du ban, ou NULL si l'email n'est pas banni
select public.is_email_banned('email@exemple.com');

-- Test d'un email réellement banni :
-- insert into public.banned_users (user_id, banned_by, reason, banned_at, email)
-- values ('<uuid-utilisateur>', '<uuid-admin>', 'Harcèlement répété', now(), 'email@exemple.com');
-- select public.is_email_banned('email@exemple.com');   -- doit renvoyer 'Harcèlement répété'

-- Vérifie que l'email ne peut plus lire la table directement (doit échouer en 401/403)
-- curl -H "apikey: <ANON_KEY>" "https://rdtvftclctwfqtpkbzlf.supabase.co/rest/v1/banned_users?select=email"