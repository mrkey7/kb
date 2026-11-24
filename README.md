# Konten Builder (KB)

Konten Builder adalah aplikasi untuk menyusun konten halaman web dengan pendekatan notasi spreadsheet (Excel/Google Sheets), sehingga pengguna tidak harus mahir pemrograman.

Pengembangan tahap awal berfokus pada penggunaan lokal. Aplikasi dijalankan melalui server Python; mode online akan dipertimbangkan setelah sistem lokal matang.

## Menjalankan

1. Clone repository.
2. Pastikan Python 3 tersedia.
3. Jalankan:

   ```bash
   python lokal/run.py
   ```

4. Browser akan membuka `http://127.0.0.1:4000`.

## Workspace proyek

Secara default, proyek pengguna disimpan di folder `Proyek-KB` pada direktori home pengguna, terpisah dari repository KB.

Lokasi dapat diubah melalui properti `workspace` di `lokal/settings.json`. Gunakan path absolut, misalnya:

```json
{
  "server": { "host": "127.0.0.1", "port": 4000, "auto_open": true },
  "workspace": "D:/Proyek-KB"
}
```

## Struktur

- `app/` — antarmuka aplikasi.
- `engine/` — logika pemrosesan konten dan building.
- `storage/` — batas abstraksi penyimpanan proyek.
- `lokal/` — server Python dan konfigurasi lokal.
- `templates/` — template awal proyek.

Kerangka saat ini menyediakan server lokal dan pengelolaan dasar workspace/proyek. Parser spreadsheet, editor notasi, preview halaman, dan proses build akan dikembangkan bertahap.
