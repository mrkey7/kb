# Engine

Tempat logika inti KB: membaca notasi konten, memvalidasi struktur, membentuk model halaman, lalu menghasilkan output website.

Engine tidak boleh bergantung langsung pada lokasi filesystem. Akses file dilakukan melalui lapisan `storage`.
