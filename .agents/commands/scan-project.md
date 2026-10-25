---
description: Scan repo .NET dan buat/perbarui profil proyek (project-profiles/<project>/SKILLS.md)
argument-hint: <nama-proyek atau owner/repo>
---

Jalankan alur scan untuk: **$ARGUMENTS**

1. Cek apakah `.office/state.json` masih memiliki histori task sebelumnya; bila ada, tanyakan ke user apakah ingin di-clear (`reset` / `dispose`) atau disimpan. Set `node tools/office-state.mjs task scan-$ARGUMENTS "Scan proyek $ARGUMENTS" "$ARGUMENTS" "-" "-"` dan `phase profile`.
2. Cari proyek di `office.config.yml`. Bila belum ada, tanyakan satu kali: nama repo GitHub (`owner/repo`) dan base branch. Repo belum ter-clone = clone ke `workspace/` (akan minta izin).
3. Panggil agent `scout` (skill `project-scanner`). `node tools/office-state.mjs handoff manager scout "scan"`.
4. Tampilkan ringkasan temuan dan **Pertanyaan terbuka** dari scout. Minta user mengonfirmasi klasifikasi (microservice/monolith/legacy), TFM, dan strategi DB test.
5. Setelah user mengoreksi/menyetujui, ubah `status: confirmed` di profil dan `phase done`.

