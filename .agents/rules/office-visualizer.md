# Visualizer kantor (wajib)

Kantor ini punya visualizer yang membaca `.office/state.json` dan `.office/chat.json`. Perbarui lewat terminal dari root folder ini (Node 18+). Gagal menulis tidak boleh menghentikan pekerjaan. Alur kerja lengkap ada di `AGENTS.md`.

Awal setiap instruksi dari user:
`node tools/office-state.mjs say user "<ringkasan singkat prompt user>"`

Saat pindah langkah / peran:
```
node tools/office-state.mjs task <id> "<judul>" <project> <branch> <mode A|B>
node tools/office-state.mjs phase <intake|profile|plan|gate1|branch|code|test|docs|gate2|release|done>
node tools/office-state.mjs agent <manager|scout|architect|developer|qa|scribe|release> <idle|working|waiting|done|blocked> "<pesan singkat>"
node tools/office-state.mjs handoff <dari> <ke> "<label>"
node tools/office-state.mjs gate <1|2|3|none> "<pertanyaan ke user>"
```

Aturan penting Gate & Selesai:
- Segera setelah user menyetujui/proceed sebuah Gate (`gate1`, `gate2`, `gate3`), **wajib** bersihkan gate (`node tools/office-state.mjs gate none`) dan pindahkan `phase` ke fase kerja berikutnya agar animasi `"Menunggu keputusanmu"` langsung berhenti.
- Saat seluruh pekerjaan yang diminta user telah selesai dan tidak ada aksi lanjut yang menunggu izin user, **wajib** set `node tools/office-state.mjs gate none` dan `node tools/office-state.mjs phase done`.
- Panel **Percakapan** hanya menampilkan ringkasan/poin penting percakapan (`user` & `assistant`), bukan log detail setiap tool call atau thinking.
- Panel **Aktivitas** scrollable menampilkan log aktivitas hingga 100 entri.

Akhir setiap jawaban ke user:
`node tools/office-state.mjs say assistant "<ringkasan singkat jawaban>"`

Saat memerankan sebuah peran (scout, architect, developer, qa, scribe, release), set statusnya `working` di awal dan `done` di akhir.

Saat mulai **task/scan baru** (bila `.office/state.json` atau `.office/chat.json` masih berisi histori task sebelumnya) atau saat **task selesai (`phase done`)**, **tanyakan (prompt) ke user** apakah histori pengerjaan & chat sebelumnya ingin di-clear/dispose:
- Clear visualizer & chat saja: `node tools/office-state.mjs reset`
- Dispose penuh (clear visualizer + chat + hapus `.office/tasks/<task-id|all>`): `node tools/office-state.mjs dispose [all|<task-id>]`
Jangan menjalankan `reset` atau `dispose` otomatis tanpa persetujuan user.
