# Katkı kuralları (Locally + Tideline)

## Temel kural

**Her prompt/görev ayrı bir branch'te çalışır; `main`'e yalnızca PR ile birleşir.**

```sh
git switch -c p-<gorev-adi>            # ör. p-us-onboarding, p-admin-audit
# ... çalış, commit et ...
git push -u origin HEAD
gh pr create --base main --fill
```

`main`'e doğrudan push, repodaki `.githooks/pre-push` hook'u tarafından
onaya bağlanır (terminal yoksa reddedilir). Hook `npm install` sırasında
(`prepare` script'i) kendiliğinden devreye girer; elle kurmak için:

```sh
git config core.hooksPath .githooks
```

Bilinçli bir istisna (acil düzeltme) için: `ALLOW_MAIN_PUSH=1 git push origin main`.

## Paralel oturumlar (birden fazla AI/insan aynı anda çalışırken)

Aynı çalışma klasörünü paylaşan oturumlar **aynı git index'ini** paylaşır:
bir oturumun `git add`'i ile `git commit`'i arasında başka bir oturumun
stage ettiği dosyalar commit'e karışabilir. Bu yüzden:

- **Tercih edilen:** her oturum kendi worktree'sinde çalışsın —
  `git worktree add ../locally-p-<gorev> -b p-<gorev>`.
  Ayrı klasör, ayrı index, ayrı branch; birbirinin dosyasını görmezler.
- Aynı klasörde çalışmak zorundaysan: asla `git add -A` / `git add .` /
  `git commit -a` kullanma. Yalnızca kendi dosyalarını, yol vererek commit et:
  `git commit -- <yol1> <yol2>` (index'te başkasının stage ettiği her şeyi
  dışarıda bırakır).
- Başka bir oturumun da düzenlediği bir dosyada yalnızca kendi değişikliğini
  commit etmen gerekiyorsa o dosyayı commit'e alma; oturumlar arası mesajla
  sahibine bildir.

## Commit öncesi

- Locally: `npx tsc --noEmit` ve `npm run lint`
- Tideline API (`tideline/apps/api`): `npm run typecheck`, `npm run lint`, `npm test`
- Yeni Supabase migration'ı: dosyanın sonuna `schema_migrations_log` kaydını ekle
  (bkz. `supabase/migrations/20260820000200_schema_migrations_log.sql`).
