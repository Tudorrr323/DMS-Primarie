# Documentație VFS (Virtual File System) - Backend Supabase

## 1. Arhitectura Generală
VFS utilizează o schemă dedicată (`vfs`) pentru a izola logica sistemului de fișiere de restul aplicației. Aceasta asigură securitate sporită, management centralizat al spațiului și o pistă de audit clară.

### 1.1 Configurații Globale și Tipuri de Date
Sistemul definește tipuri de date specifice (ENUMs) pentru a asigura integritatea datelor:
*   `vfs.access_level`: Definește permisiunile utilizatorilor (`viewer`, `editor`).
*   `vfs.audit_entity_type`: Tipurile de obiecte monitorizate (`folder`, `file`, `permission`, `space`).
*   `vfs.audit_action_type`: Acțiunile posibile (`CREATE`, `UPDATE`, `DELETE`, `MOVE`, `SHARE`, `RESTORE`).

## 2. Structura Bazei de Date

### 2.1. `vfs.user_space`
Reprezintă "hard disk-ul" virtual al fiecărui utilizator.
*   **Rol:** Container logic pentru toate datele unui utilizator.
*   **Izolare:** Fiecare rând este legat unic de un `profile_id` din tabela `public.profiles`.
*   **Cote:** Gestionează limitele de stocare (default 500MB) și consumul curent (`storage_used`).

### 2.2. `vfs.folders`
Implementează structura ierarhică a directoarelor.
*   **Model:** Adjacency List (folosește `parent_id` pentru ierarhie).
*   **Root:** Un folder cu `parent_id` NULL este considerat rădăcină (de obicei "My Drive").
*   **Constrângeri:** Nu pot exista două foldere cu același nume în același director părinte.
*   **Soft Delete:** Coloana `deleted_at` permite mutarea în "Coșul de Gunoi" fără ștergere fizică imediată.

### 2.3. `vfs.files` și `vfs.file_versions`
Separă metadatele fișierului de conținutul fizic pentru a permite versionarea.
*   **`vfs.files` (Metadata):** Conține numele, tipul MIME, locația logică (folder) și starea (șters/activ).
*   **`vfs.file_versions` (Storage):** Leagă metadatele de obiectele din Supabase Storage (`vfs-bucket`). Conține calea fizică (`storage_path`), mărimea și numărul versiunii.
*   **Versionare:** Încărcarea unui fișier cu același nume peste unul existent creează o nouă intrare în `file_versions`, păstrând istoricul.

### 2.4. `vfs.permissions`
Gestionează partajarea resurselor (Sharing).
*   **Granularitate:** Permisiunile pot fi acordate per fișier sau per folder.
*   **Niveluri:** `viewer` (doar citire) sau `editor` (modificare/ștergere).
*   **Moștenire:** Sistemul logic din backend verifică permisiunile recursiv (dacă ai acces la părinte, ai acces la copil).

### 2.5. `vfs.audit_log`
Înregistrează toate acțiunile critice pentru securitate și istoric.
*   **Imuabilitate:** Scris automat de triggere (`vfs.process_audit_log`), greu de modificat manual.
*   **Detalii:** Păstrează starea anterioară (`old_data`) și starea nouă (`new_data`) în format JSONB.

## 3. Securitate (Row Level Security - RLS)
Toate tabelele au RLS activat. Accesul este controlat strict prin politici PostgreSQL.

### 3.1. Politici Principale
*   **User Space:** Utilizatorii își văd doar propriul spațiu.
*   **Folders/Files (Citire):** Un utilizator poate vedea un element dacă:
    1.  Este proprietarul spațiului (`space_id` îi aparține).
    2.  Are o permisiune directă în `vfs.permissions`.
    3.  Are acces moștenit dintr-un folder părinte (verificat prin funcția recursivă `vfs.has_access`).
*   **Permissions (Management):** Doar proprietarul real al spațiului unde se află fișierul/folderul poate acorda sau revoca permisiuni.

### 3.2. Funcții de Securitate
*   `vfs.has_access(_folder_id, _profile_id)`: Funcție `SECURITY DEFINER` (rulează ca admin) care traversează arborele de foldere în sus pentru a verifica permisiunile moștenite, ocolind recursivitatea infinită a politicilor RLS standard.

## 4. Automatizare și Triggere

### 4.1. Setup Utilizator (`vfs.handle_new_user_setup`)
La crearea unui cont nou în `public.profiles`, acest trigger:
1.  Creează automat o intrare în `vfs.user_space`.
2.  Creează folderul rădăcină "My Drive".

### 4.2. Sincronizare Stocare (`vfs.sync_storage_usage`)
La adăugarea sau ștergerea unei versiuni de fișier (`vfs.file_versions`), acest trigger recalculează automat suma `size` și actualizează `storage_used` în `vfs.user_space`.

### 4.3. Audit Automat (`vfs.process_audit_log`)
Orice operațiune (INSERT, UPDATE, DELETE) pe tabelele principale este interceptată și logată în `vfs.audit_log`, asigurând trasabilitatea completă a acțiunilor (cine, ce, când, cum).

## 5. Mentenanță și Cleanup

### 5.1. Gestionarea Coșului de Gunoi
*   `vfs.moveToTrash`: Setează `deleted_at`. Elementele devin invizibile în listele standard.
*   `vfs.restoreFromTrash`: Resetează `deleted_at` la NULL.
*   `vfs.cleanup_trash`: Funcție programată (cron) care șterge definitiv elementele marcate ca șterse de mai mult de 30 de zile.

### 5.2. Curățarea Versiunilor Vechi
*   `vfs.cleanup_useless_versions`: Șterge versiunile vechi (care nu sunt curente) după o perioadă definită, pentru a economisi spațiu.
