---
description: Mulai task baru (Mode A: sebut file, atau Mode B: jelaskan business flow/issue)
argument-hint: <deskripsi task singkat, boleh kosong>
---

Mulai task baru. Input awal user: **$ARGUMENTS**

Ikuti "Alur kerja" di `AGENTS.md` dari Fase 1. Ringkas:

1. Cek apakah `.office/state.json` masih memiliki task sebelumnya. Bila ada, tanyakan ke user (sekaligus dengan pertanyaan intake) apakah histori sebelumnya ingin di-clear (`node tools/office-state.mjs reset` atau `node tools/office-state.mjs dispose`) atau tetap disimpan. Buat `task-id` (`YYYYMMDD-slug`), lalu `task <id> "<judul>" <project> <branch> <A|B>` dan `phase intake`.
2. Tanyakan sekaligus hanya yang belum jelas: proyek, Mode A/B (file atau business flow/issue), **nama branch**, issue/Jira key, contoh pola Unit Test, dan apakah ini feature baru.
3. Cek branch ada/tidaknya (skill `git-workflow`) dan beri tahu user hasilnya.
4. Buat `.office/tasks/<id>/brief.md` dari `templates/task-brief.md`.
5. Lanjut Fase 2 (profil), Fase 3 (plan oleh `architect`), lalu **berhenti di Gate 1**. Jangan coding sebelum user menyetujui.

