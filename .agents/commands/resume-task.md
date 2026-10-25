---
description: Lanjutkan task yang tertunda atau jawab sebuah gate (approve/revisi/batal)
argument-hint: <task-id> [keputusan, misal "approve opsi A"]
---

Lanjutkan task: **$ARGUMENTS**

1. Baca `.office/state.json` dan folder `.office/tasks/<task-id>/` (`brief.md`, `plan.md`, `test-report.md`, `docs-draft.md`, ...). Tentukan fase terakhir yang selesai.
2. Ada keputusan user di argumen: terapkan pada gate yang sedang menunggu (`approve opsi X` = lanjut; revisi = kembali ke agent terkait; batal = `phase done` dan catat alasan). Tidak ada keputusan dan gate masih menunggu: tampilkan ulang pertanyaan gate. Diam bukan persetujuan.
3. Verifikasi kondisi repo sebelum lanjut: branch aktif benar, working tree sesuai, commit yang diharapkan ada.
4. Lanjutkan dari fase berikutnya sesuai `AGENTS.md`.

