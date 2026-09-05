# PRD — Community / Q&A ("Savol-javob")

**Status:** draft for approval · **Owner:** Gulchiroy · **Author:** build agent · **Date:** 2026-09-05

---

## 1. Summary
A public question-and-answer board on the Camelia site where followers ask Gulchiroy anything —
Korea, language learning, or content they'd like her to make — and **everyone can read the
questions and her answers**. An Instagram bio link opens directly into the "ask" modal, so a
follower can go from Instagram → ask in one tap.

## 2. Problem / Why
Gulchiroy creates content and gets the same questions repeatedly across DMs, where answers are
private and lost. There's no public, reusable place for "what do you want from me?" or Korea /
language questions. Goal: **one public, searchable Q&A** that turns her answers into evergreen,
shareable content and a content-idea inbox.

## 3. Goals & success signals
- Followers can ask in **< 10 seconds, no account**, straight from Instagram.
- Answered Q&A is **public and browsable**, reducing repeat DMs.
- Gulchiroy has **one place** to triage questions and publish answers.
- Success (informal): steady inflow of questions; a growing answered list; content ideas captured.

## 4. Non-goals (out of scope, this version)
- Accounts/login to ask (stays anonymous-friendly).
- Threaded replies / follower-to-follower discussion (it's ask → she answers).
- Upvotes, search, notifications, rich media in questions — all **later**.
- Moderation automation / spam AI — only manual hide/delete now.

## 5. Personas
- **Follower (asker)** — arrives from Instagram; wants to ask or see if it's answered. Uzbek UI.
- **Reader** — browses answered Q&A for useful info.
- **Gulchiroy (admin)** — reviews incoming questions, answers, hides spam.

## 6. User stories
1. As a follower, I tap the Instagram link and a modal opens asking *"Nima so'ramoqchisiz?"* so I can
   type my question (optionally my name + topic) and send it.
2. As a reader, I browse answered questions, filtered by topic (Koreya / Til / Kontent / Boshqa).
3. As Gulchiroy, I see new questions, write an answer, and it publishes automatically.
4. As Gulchiroy, I can hide or delete inappropriate questions.

## 7. Functional requirements
### 7.1 Ask (public)
- "Savol berish" button on `/community`, and auto-open via **`/community?ask=1`** (the Instagram link).
- Modal fields: **question** (required, 5–1000 chars), **name** (optional; blank → "Anonim"),
  **topic** (optional select: Dasturchilik / Ingliz tili / Koreys tili / Shaxsiy maslahat / Koreya / Koreyada ishlash / Boshqa).
- Submit → stored as **pending** (not visible publicly). Success message: *"Rahmat! Savolingiz ko'rib
  chiqiladi."* Errors shown inline in Uzbek.
- Submission goes through a server API (service role) — anon cannot write arbitrary rows.

### 7.2 Browse (public)
- `/community` lists **answered** questions, newest first, as question + answer cards.
- Topic filter chips (Hammasi + each topic). Empty state when none.

### 7.3 Answer / moderate (admin)
- `/admin/community`: tabs **Yangi (pending)** / **Javob berilgan** / **Yashirilgan**.
- Answer form per question → sets `answer`, `status='answered'`, `answered_at` → now public.
- Hide (→ hidden), Unhide, Delete. Admin-only (verified server-side).

### 7.4 Instagram deep link
- The bio link is `https://<site>/community?ask=1`; on load the ask modal opens automatically.

## 8. UX / pages
- **`/community`** (public): header + short intro ("Menga savol bering — Koreya, til o'rganish yoki
  qanday kontent xohlaysiz"), "Savol berish" CTA, topic chips, answered Q&A cards, ask modal.
- **Ask modal**: name (optional), topic (optional), question (required), Yuborish button.
- **`/admin/community`**: triage tabs + answer/hide/delete, consistent with `/admin/orders` styling.
- Entry points: footer link on landing (`Savol-javob`) + AdminNav item.

## 9. Data model — `community_questions`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text null | optional display name; null → "Anonim" |
| question | text not null | 5–1000 chars (enforced in API) |
| answer | text null | null until answered |
| topic | text null | korea / til / kontent / boshqa |
| status | text | 'pending' \| 'answered' \| 'hidden' (default 'pending') |
| created_at | timestamptz | default now() |
| answered_at | timestamptz null | set when answered |

Index on `(status, answered_at desc)`. SQL delivered as `docs/community-setup.md` (owner runs).

## 10. API
- `POST /api/community/ask` — validate + insert pending (service role).
- `POST /api/admin/community` — admin-only: `answer` / `hide` / `unhide` / `delete`.

## 11. Security & privacy
- **RLS:** public (anon) may **read only `status='answered'`**; no anon insert/update — submissions
  and moderation run through server APIs with the service role. Admin verified via `profiles.role`.
- **Anonymity:** name optional; we do not collect the asker's identity. (If logged-in customer,
  we still don't attach identity in v1.)
- **Abuse:** manual hide/delete now; rate-limiting is a fast-follow (see §13).
- Never expose pending/hidden questions publicly.

## 12. Rollout
1. SQL (`community-setup.md`) — table + RLS.
2. Public page + ask modal + `/api/community/ask`.
3. Admin triage + `/api/admin/community`.
4. Links (footer + AdminNav) + Instagram deep link.
All shippable together; page degrades to an empty state before any questions exist.

## 13. Open questions / decisions (defaults in **bold**)
1. Ask anonymously vs require Telegram login? → **Anonymous, name optional.**
2. Show only answered publicly, or also open questions? → **Only answered.**
3. Topics — ✅ Dasturchilik / Ingliz tili / Koreys tili / Shaxsiy maslahat / Koreya / Koreyada ishlash / Boshqa.
4. Notify Gulchiroy on a new question (Telegram via `notifyOwner`)? → ✅ **Yes, in v1** (notifyOwner).
5. Spam guard (min interval / simple captcha)? → **Fast-follow; manual hide/delete for launch.**

## 14. Acceptance criteria
- Submitting from `/community` (and via `?ask=1`) creates a **pending** row; nothing appears publicly.
- Answering in `/admin/community` makes exactly that Q&A visible on `/community`.
- Hidden/pending questions never returned by the public (anon) query.
- Topic filter shows the right subset; empty states render.
- Admin actions rejected for non-admins.
