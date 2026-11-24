# Konten Builder

KB menerjemahkan spreadsheet menjadi halaman web. Excel dan Google Sheets tetap menjadi editor utama; KB tidak membangun ulang fitur spreadsheet.

## Prinsip proyek
Setiap proyek menyimpan sumber editor sebagai sumber data utama:
- **Excel:** file `editor.xlsx` tersimpan di folder proyek KB dan dibuka dengan aplikasi Excel.
- **Google Sheets:** proyek menyimpan URL editor dan URL publik CSV. Dokumen tetap berada di Google Drive dan dapat diedit melalui iframe atau tab penuh.
- Preview dibangun ulang dari sumber proyek kapan pun diperlukan. KB tidak mengubah file sumber ketika melakukan render.

## Menjalankan
1. Instal Python 3.10+.
2. Jalankan `pip install -r requirements.txt`.
3. Jalankan `python lokal/run.py` atau `python lokal/server.py`.

## Alur
1. Buat proyek pada panel **Proyek**. KB otomatis membuat template kosong `editor.xlsx`.
2. Untuk Excel, buka editor dari panel **Editor**. File dibuka dengan aplikasi spreadsheet desktop dan disimpan langsung di folder proyek. Setelah selesai mengedit, pilih **Preview** lalu **Render / Perbarui preview**.
3. Untuk Google Sheets, buat spreadsheet di Drive, masukkan URL edit dan URL **Publish to web → CSV** pada panel **Sumber**. KB menyimpan kedua referensi pada proyek. Editor dapat ditampilkan di area kerja atau dibuka di tab penuh.
4. Setiap proyek dapat dibuka, diganti nama, atau dihapus. Menghapus proyek juga menghapus file lokal proyek tersebut.

## Batasan tahap ini
- Google Sheets memerlukan akses editor yang sesuai. Untuk penerjemahan, URL Publish to web CSV diperlukan.
- Excel berjalan melalui aplikasi desktop, bukan ditanam sebagai aplikasi Excel interaktif di browser. File sumber tetap berada di folder proyek; KB menyediakan pembukaan, unduhan, dan penggantian file.
- Render awal menerjemahkan nilai sel dari sheet aktif menjadi tabel HTML sederhana. Format visual, formula yang memerlukan kalkulasi Excel, banyak sheet, lebar kolom, dan tinggi baris belum diterjemahkan.
