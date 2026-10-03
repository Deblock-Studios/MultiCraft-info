/* ─────────────────────────────────────────────────────────────────
 *  VERROUILLAGE DES DROITS D'ÉCRITURE
 *  Projet Supabase : rdtvftclctwfqtpkbzlf
 *
 *  Constat : les 5 tables du site accordent POST à anon et à authenticated.
 *  Or le code n'écrit JAMAIS dans user_roles (un simple GET suffit), et
 *  anon n'écrit rien du tout. Ces droits d'écriture sont donc inutiles
 *  et constituent une escalade de privilèges : n'importe quel visiteur
 *  peut s'attribuer le rôle admin, ou injecter des messages/avis.
 *
 *  Ce script ne modifie que les DROITS (grants), jamais les policies RLS :
 *  il ne peut donc pas casser le fonctionnement du site.
 *
 *  ⚠️ Le Dashboard Supabase continue de fonctionner : il utilise service_role
 *     / la connexion postgres, non affectés par ces revokes.
 *
 *  Idempotent : rejouable sans risque.
 * ───────────────────────────────────────────────────────────────── */


/* ── 1. DIAGNOSTIC (lecture seule, execute avant pour confirmer) ── */

select c.relname as table,
       c.relrowsecurity as rls_active,
       has_table_privilege('anon','public.'||c.relname,'insert') as anon_insert,
       has_table_privilege('anon','public.'||c.relname,'update') as anon_update,
       has_table_privilege('anon','public.'||c.relname,'delete') as anon_delete,
       has_table_privilege('authenticated','public.'||c.relname,'insert') as user_insert,
       has_table_privilege('authenticated','public.'||c.relname,'update') as user_update
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by c.relname;


/* ── 2. LE TROU CRITIQUE : les rôles ne doivent pas être modifiables par le site ── */

-- Personne, même connecté, ne modifie un rôle via le site : la gestion se fait
-- depuis le Dashboard (Authentication → utilisateurs, ou ce fichier SQL).
revoke insert, update, delete on public.user_roles from anon, authenticated;


-- Bonus : plus personne ne peut s'auto-attribuer un rôle.
-- INSERT avec une seule ligne qui aurait été refusée par les droits.
-- delete from public.user_roles where user_id = 'ton-uuid' and role_id = 3;


/* ── 3. anon passe en lecture seule ── */

-- Le site écrit uniquement en tant qu'utilisateur connecté (chat, avis, avis de
-- notation). Tout le reste est public et ne demande que la lecture.
revoke insert, update, delete on public.banned_users from anon;
revoke insert, update, delete on public.global_chat from anon;
revoke insert, update, delete on public.private_messages from anon;
revoke insert, update, delete on public.reviews from anon;


/* ── 4. authenticated garde l'écriture sur le contenu, pas sur les rôles ── */

-- Cette ligne est neutre (elle reaffirme l'etat voulu). Les etats de depart
-- variables d'un projet a l'autre.font : laisse-la commenter pour l'instant.
-- revoke insert, update, delete on public.global_chat from authenticated;


/* ── 5. VERIFICATION ── */

-- Doit afficher false partout pour les privileges d'ecriture.
select 'user_roles' as table,
       has_table_privilege('anon','public.user_roles','insert') as anon_insert,
       has_table_privilege('authenticated','public.user_roles','insert') as user_insert
union all select 'global_chat',
       has_table_privilege('anon','public.global_chat','insert'),
       has_table_privilege('authenticated','public.global_chat','insert')
union all select 'private_messages',
       has_table_privilege('anon','public.private_messages','insert'),
       has_table_privilege('authenticated','public.private_messages','insert')
union all select 'reviews',
       has_table_privilege('anon','public.reviews','insert'),
       has_table_privilege('authenticated','public.reviews','insert')
union all select 'banned_users',
       has_table_privilege('anon','public.banned_users','insert'),
       has_table_privilege('authenticated','public.banned_users','insert');

-- La lecture publique doit toujours fonctionner (retourne 200 + lignes)
select count(*) as roles_lisibles_par_anon from public.user_roles;


/* ═══ OPTION : activer la RLS (protection en profondeur) ═══════════

   Les revokes ci-dessus suffisent a bloquer les visiteurs non connectes.
   Activer la RLS ajoute une second barrier, MAIS elle exige d'ecrire
   exactement les policies correspondant a ce que le site fait, sinon le
   chat, les messages prives ou les avis cessent de fonctionner.

   A n'activer qu'apres avoir teste chaque feature (chat global, message
   prive, avis, notation, bannissement) avec un compte connecte.

   Exemple pour le chat global (lecture publique, ecriture par un utilisateur
   connecte, seuls ses propres messages modifiables) :

-- alter table public.global_chat enable row level security;
-- drop policy if exists "chat read" on public.global_chat;
-- create policy "chat read" on public.global_chat for select to anon, authenticated using (true);
-- drop policy if exists "chat write" on public.global_chat;
-- create policy "chat write" on public.global_chat for insert to authenticated with check (auth.uid() is not null);
-- drop policy if exists "chat edit" on public.global_chat;
-- create policy "chat edit" on public.global_chat for update to authenticated using (sender_id = auth.uid()::text);
*/