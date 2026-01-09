# DMS Primărie - Sistem de Management al Documentelor

Această aplicație este o soluție digitală completă pentru gestionarea fluxului de documente într-o instituție publică (Primărie). Sistemul digitalizează procesul de depunere, verificare, avizare și semnare a cererilor cetățenilor, oferind transparență și eficiență.

Proiectul este găzduit pe [Vercel](https://vercel.com).

---

## 📋 Descriere Proiect

Aplicația simulează un scenariu real în care o cerere depusă de un cetățean trece printr-un flux birocratic automatizat, fiind procesată succesiv de mai multe departamente înainte de a primi o soluție finală.

### Fluxul de Lucru (Workflow)

1.  **Depunere (Cetățean):** Cetățeanul completează formularul online și încarcă documentele necesare.
2.  **Verificare Inițială (Funcționar X):** Verifică completitudinea dosarului. Poate accepta sau respinge cererea.
3.  **Verificare Tehnică (Funcționar Y):** Analizează conținutul, poate adăuga alte fișiere.
4.  **Verificare Finală & Semnare (Funcționar Z):** Generează certificatul de aprobare, aplică semnătura digitală și finalizează cererea.
5.  **Finalizare:** Cetățeanul primește notificare pe email și poate descărca documentele oficiale din contul său.

---

## 🛠️ Stack Tehnologic

### Frontend
*   **React + Vite:** Pentru o experiență rapidă și modernă (SPA).
*   **TailwindCSS + shadcn/ui:** Pentru interfață grafică responsive și accesibilă.
*   **React Router:** Gestionarea rutelor și protejarea paginilor pe bază de roluri.
*   **React PDF & PDF-Lib:** Vizualizare, manipulare și semnare digitală a PDF-urilor direct în browser.
*   **Zustand / Context API:** Managementul stării aplicației.
*   **Recharts:** Grafice pentru dashboard-ul de administrare.

### Backend (Supabase)
*   **PostgreSQL:** Baza de date relațională.
*   **Authentication:** Gestionarea utilizatorilor și a rolurilor (Row Level Security - RLS).
*   **Storage:** Stocarea securizată a fișierelor (cereri, anexe, certificate).
*   **Realtime:** Actualizarea automată a cozilor de lucru (Queues) când apar cereri noi.
*   **Database Functions (RPC):** Logica complexă de business (tranziții workflow, alocare automată a sarcinilor) este stocată direct în baza de date pentru performanță.
*   **Edge Functions:** Notificări pe email (via Nodemailer) la finalizarea cererilor.

---

## 🚀 Instrucțiuni de Instalare și Setup

### 1. Clonare Repository
```bash
git clone <url-repo>
cd dms-app
```

### 2. Configurare Backend (Supabase)
Asigurați-vă că aveți Supabase CLI instalat și sunteți logat.

```bash
cd supabase
# Porniți instanța locală Supabase
supabase start

# Aplicați migrările bazei de date (creare tabele, funcții, RLS)
supabase db reset
```

*Notă:* Migrările vor crea structura necesară: tabele (`documents`, `profiles`, `workflow_history`), tipuri ENUM și funcții PL/PGSQL pentru logica de workflow.

### 3. Configurare Frontend
Navigați în folderul de frontend și instalați dependențele.

```bash
cd ../frontend
npm install
```

Creați un fișier `.env` în folderul `frontend` cu următoarele variabile (datele le găsiți în output-ul comenzii `supabase start`):

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Pornire Aplicație
```bash
npm run dev
```
Aplicația va fi accesibilă la `http://localhost:5173`.

---

## ☁️ Deploy

Aplicația frontend este configurată pentru a fi desfășurată ușor pe **Vercel**.
Fișierul `vercel.json` din directorul `frontend` asigură rutarea corectă pentru aplicația Single Page Application (SPA).

---

## 🔑 Credențiale Demo

Pentru a testa fluxul complet, utilizați următoarele conturi predefinite (sau creați-le în panoul de administrare Supabase dacă este o instanță curată):

### 1. Rol: Admin
*   **Email:** `admin@primarie.ro`
*   **Parolă:** `password123`
*   **Acces:** Dashboard general, statistici, re-asignare sarcini, loguri de activitate.

### 2. Rol: Funcționari (Pe departamente)
*   **Verificare Inițială:** `x1@primarie.ro` (Parola: `password123`)
*   **Verificare Tehnică:** `y1@primarie.ro` (Parola: `password123`)
*   **Verificare Finală:** `z1@primarie.ro` (Parola: `password123`)

### 3. Rol: Cetățean
*   **Email:** `craciunclaudiu796@gmail.com`
*   **Parolă:** `1234567`
*   **Acces:** Depunere cereri, vizualizare status propriu, descărcare documente.

---

## ✨ Funcționalități Cheie

### 🔐 Securitate și Permisiuni
*   **Row Level Security (RLS):** Datele sunt protejate la nivel de bază de date. Un cetățean își vede doar propriile cereri. Un funcționar vede doar cererile din stadiul departamentului său.
*   **Protected Routes:** Rutele din frontend sunt blocate pentru utilizatorii neautentificați sau fără rolul necesar.

### 📄 Management Documente
*   **Preview PDF:** Vizualizare documente direct în aplicație fără descărcare.
*   **Semnătură Digitală:** Posibilitatea de a plasa semnături vizuale pe documente (coordonate X/Y) și de a contrasemna certificate.
*   **Generare Automată:** Sistemul generează automat "Certificatul de Aprobare" în format PDF la finalizarea fluxului.

### ⚡ Timp Real și Colaborare
*   **Live Updates:** Coada de lucru a funcționarilor se actualizează instantaneu când o cerere este depusă sau mutată dintr-un stadiu în altul.
*   **Prezență (Presence):** Adminul poate vedea în timp real ce funcționari sunt online și la ce dosar lucrează.

### 📊 Monitorizare (Admin)
*   **Activity Logs:** Jurnal complet de audit pentru orice acțiune (schimbare status, încărcare fișier, comentariu).
*   **Bottlenecks:** Grafice care arată timpul mediu de procesare pe fiecare departament pentru a identifica blocajele.
