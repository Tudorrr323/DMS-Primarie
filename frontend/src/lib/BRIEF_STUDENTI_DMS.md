# BRIEF PROIECT - Document Management System (DMS)
**Studenți:** Claudiu & Tudor
**Durată:** 5-6 zile × 6-8h/zi
**Stack:** React + Node.js + Supabase

---

## OBIECTIV

### Ce veți construi?

Un **sistem web complet** pentru gestionarea cererilor cetățenilor la primărie - similar cu cum funcționează în realitate procesul de la depunerea unei cereri până la obținerea răspunsului.

### Scenariul Real

**Problema actuală:** Când un cetățean depune o cerere la primărie (ex: certificat, autorizație, aprobare), documentul trece prin mâinile mai multor funcționari pentru verificări, fiecare adaugă viza/semnătura lor, iar cetățeanul nu știe în ce stadiu se află cererea lui.

**Soluția voastră:** O platformă digitală unde:

1. **Cetățeanul** (ex: Ion Popescu):
   - Se loghează și completează un formular online
   - Upload-ează documentele necesare (PDF, imagine, etc)
   - Vede în timp real: "Cererea ta e la Funcționarul Y pentru verificare"
   - Primește notificare când e gata și o poate descărca

2. **Funcționarul X** (primul verificator):
   - Vede în dashboard-ul lui toate cererile noi
   - Verifică dacă documentele sunt complete
   - Aprobă și trimite mai departe sau Respinge cu motiv

3. **Funcționarul Y** (verificare tehnică):
   - Primește cererea în queue-ul lui
   - Verifică detaliile tehnice
   - Poate uploada documente suplimentare (anexe, avize)
   - Semnează digital ("Verificat de Maria Ionescu - 29.12.2025")
   - Trimite la următorul stadiu

4. **Funcționarul Z** (aprobare finală):
   - Face verificarea finală
   - Adaugă semnătura lui
   - Marchează cererea ca "Completă"
   - → Cetățeanul poate descărca documentul final cu toate semnăturile

5. **Admin**:
   - Vede toate cererile, pe toate stadiile
   - Monitorizează: "Care stadiu durează cel mai mult?"
   - Poate reassigna cereri dacă un funcționar e în concediu

### De ce e cool proiectul?

- **Real-world application** - exact așa funcționează în primării moderne
- **Full-stack** - backend, frontend, bază de date, autentificare, file storage
- **Workflow complex** - tranziții între stadii, permisiuni, audit log
- **Modern tech** - React, Supabase (Firebase-like dar pentru PostgreSQL)
- **Portfolio-ready** - poți arăta angajatorilor un sistem real, nu doar un TODO app

### Ce învățați?

- Cum se face un sistem multi-user cu roluri diferite
- Workflow engine (state machines)
- File upload & management
- Real-time updates (când altcineva ia o cerere, dispare din queue-ul tău)
- Row Level Security (RLS) - fiecare vede doar ce trebuie
- Git collaboration (branch, PR, code review)
- UI/UX pentru admin dashboards

---

## STACK TEHNOLOGIC

### Frontend
- **React** (Vite pentru setup rapid)
- **UI Kit:** [shadcn/ui](https://ui.shadcn.com/) - componente moderne, customizabile
- **Styling:** TailwindCSS (vine cu shadcn)
- **Rutare:** React Router v6
- **State:** Zustand (simplu, fără boilerplate)
- **Forms:** React Hook Form + Zod pentru validare

### Backend
- **Supabase** (BaaS - Backend-as-a-Service)
  - Database PostgreSQL (built-in)
  - Authentication (JWT + OAuth)
  - Storage pentru fișiere
  - Row Level Security (RLS)
  - Real-time subscriptions

### Dev Tools
- **Git/GitHub** - colaborare, feature branches
- **ESLint + Prettier** - code quality
- **Postman/Thunder Client** - testare API

---

## ARHITECTURĂ

```
dms-app/
├── frontend/               # React app
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utils, supabase client
│   │   ├── hooks/         # Custom hooks
│   │   └── stores/        # Zustand stores
│   └── public/
│
├── supabase/              # Supabase config
│   ├── migrations/        # DB schema
│   └── functions/         # Edge functions (opțional)
│
└── README.md
```

---

## FUNCȚIONALITĂȚI CORE (MVP)

### 1. Autentificare & Roluri
- Login/Register (email + password)
- 3 roluri: **Admin**, **Angajat**, **Cetățean**
- Protected routes pe bază de rol
- Logout + session management

### 2. Gestiune Documente
- **Upload** documente (PDF, DOCX, imagini - max 10MB)
- **Listare** cu paginare (10/pagină)
- **Preview/Download** documente
- **Ștergere** (doar Admin/owner)
- **Metadata:** titlu, descriere, categorie, status, data upload

### 3. Workflow Multi-Stadiu (核心功能)

**Flux cerere cetățean:**
```
[Cetățean] Depune cerere
    ↓
[Funcționar X] Primește în queue → Validează inițial
    ↓
[Funcționar Y] Verificare → Upload documente suplimentare / Semnează
    ↓
[Funcționar Z] Verificare finală → Semnează
    ↓
[COMPLETAT] Cetățean poate descărca
```

**Stadii workflow:**
1. **Submitted** (galben) - Cetățean a depus cererea
2. **In Review - Step 1** (albastru) - La Funcționar X
3. **In Review - Step 2** (portocaliu) - La Funcționar Y (+ documente/semnătură)
4. **In Review - Step 3** (violet) - La Funcționar Z (verificare finală)
5. **Completed** (verde) - Gata, descărcabil de cetățean
6. **Rejected** (roșu) - Respins în orice stadiu (cu motiv)

**Categorii documente:**
- Cereri cetățeni (cu workflow)
- Acte administrative
- Contracte
- Rapoarte

### 4. Căutare & Filtrare
- Search bar (după titlu/descriere)
- Filtre: categorie, status, dată
- Sortare: dată upload, titlu alfabetic

### 5. Permisiuni & Acțiuni pe Rol

**Cetățean:**
- Depune cerere (upload document inițial)
- Vede statusul în timp real
- Descarcă documentul final când e Completed
- Nu vede cine a procesat

**Funcționar X, Y, Z:**
- Vede queue propriu (cereri assigned)
- Poate:
  - Accepta/Respinge cerere
  - Uploada documente suplimentare (anexe, documente verificate)
  - Semna digital documentul (text overlay "Semnat de [Nume] - [Data]")
  - Trimite la următorul stadiu
  - Adăuga comentarii interne
- Vede istoric complet workflow

**Admin:**
- Acces complet (toate cererile, toate stadiile)
- Assign cereri către funcționari
- Șterge/editează orice
- Vede audit log complet

### 6. Dashboard

**Cetățean:**
- Lista cererilor mele cu status vizual
- Timeline: Submitted → Step 1 → Step 2 → Step 3 → Completed
- Notificare când e gata de descărcat

**Funcționar:**
- **My Queue** - cereri assigned mie (prioritate)
- Acțiuni rapide: Approve, Reject, Upload, Sign
- Buton "Send to Next Step" (trimite la colegul următor)

**Admin:**
- Statistici: total cereri, pe stadiu, timp mediu procesare
- Bottlenecks: care stadiu durează cel mai mult
- Assign cereri către funcționari

### 7. Audit Log & Tracking

**Activity Log (Admin only):**
- Tabel complet: cine, când, ce acțiune
- Filtrare pe document, user, acțiune

**Document Timeline (vizibil tuturor):**
- Istoric vizual pentru fiecare cerere:
  - "01.01.2025 10:30 - Depusă de Ion Popescu"
  - "01.01.2025 11:15 - Preluată de Funcționar X"
  - "01.01.2025 14:20 - Document anexat de Funcționar Y"
  - "01.01.2025 14:25 - Semnat de Funcționar Y"
  - "02.01.2025 09:00 - Verificare finală Funcționar Z"
  - "02.01.2025 09:10 - Completat"

---

## RESURSE UI KITS (100% GRATUITE)

### Recomandate (alege 1)
1. **[shadcn/ui](https://ui.shadcn.com/)** ⭐ RECOMANDAT
   - Complet gratuit, copy-paste components
   - TailwindCSS based
   - Componente utile: Table, Dialog, Form, Badge, Button, Card, Select, Stepper, Timeline

2. **[Aceternity UI](https://ui.aceternity.com/)**
   - 100% gratuit, modern cu animații
   - Timeline component perfect pentru workflow
   - Copy-paste direct

3. **[Magic UI](https://magicui.design/)**
   - Open source, gratuit
   - Componente animate frumoase

### Alternative Gratuite
- **[DaisyUI](https://daisyui.com/)** - gratuit, cu TailwindCSS, multe componente
- **[Flowbite React](https://flowbite-react.com/)** - gratuit, componente gata făcute
- **[Park UI](https://park-ui.com/)** - gratuit, bazat pe Ark UI
- **[Mantine](https://mantine.dev/)** - library completă React, gratuit
- **[Radix UI](https://www.radix-ui.com/)** - primitives gratuite (baza pentru shadcn)

---

## ÎMPĂRȚIRE TASKURI

### CLAUDIU - Backend & Database

#### Ziua 1-2: Setup & Database
- [ ] Inițializare proiect Supabase
- [ ] Design schema DB (users, documents, categories, activity_logs)
- [ ] Row Level Security (RLS) policies
- [ ] Setup Storage bucket pentru fișiere
- [ ] Configurare authentication (email/password)

**Schema DB:**
```sql
-- users (vine din Supabase Auth)
-- doar adăugăm:
profiles (
  id uuid REFERENCES auth.users PRIMARY KEY,
  email text,
  full_name text,
  role text CHECK (role IN ('cetatean', 'functionar_x', 'functionar_y', 'functionar_z', 'admin')),
  created_at timestamp
)

-- documents (cereri cu workflow)
documents (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text,
  workflow_stage text DEFAULT 'submitted',
    -- submitted | review_step1 | review_step2 | review_step3 | completed | rejected
  current_assignee uuid REFERENCES profiles(id), -- cine îl are în queue acum
  file_url text, -- documentul inițial
  file_name text,
  file_size int,
  uploaded_by uuid REFERENCES auth.users,
  rejection_reason text,
  created_at timestamp,
  updated_at timestamp,
  completed_at timestamp
)

-- document_files (multiple fișiere pe cerere)
document_files (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES documents,
  file_url text,
  file_name text,
  uploaded_by uuid REFERENCES profiles(id),
  upload_stage text, -- la ce stadiu a fost uploadat
  is_signed boolean DEFAULT false,
  created_at timestamp
)

-- workflow_history (audit trail per cerere)
workflow_history (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES documents,
  from_stage text,
  to_stage text,
  action_by uuid REFERENCES profiles(id),
  action_type text, -- 'stage_change' | 'file_upload' | 'signature' | 'rejection' | 'comment'
  comment text,
  created_at timestamp
)

-- signatures (semnături digitale)
signatures (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES documents,
  signed_by uuid REFERENCES profiles(id),
  signature_text text, -- "Semnat de [Nume] - [Data]"
  workflow_stage text, -- la ce stadiu a semnat
  created_at timestamp
)
```

#### Ziua 3-4: Workflow Engine & API
- [ ] API workflow transitions (submitted → step1 → step2 → step3 → completed)
- [ ] Funcție "Assign to Next" (auto-assign la următorul funcționar)
- [ ] Upload multiple fișiere pe cerere
- [ ] Semnătură digitală (text overlay pe document sau entry în DB)
- [ ] Reject cu motiv (poate din orice stadiu)
- [ ] Implementare filtre & search
- [ ] Trigger pentru workflow_history (log automat)
- [ ] Testare permisiuni RLS pe workflow

#### Ziua 5-6: Backend Features
- [ ] Workflow status transitions (validări)
- [ ] Statistici pentru dashboard Admin
- [ ] Export CSV pentru rapoarte
- [ ] Optimizări query-uri
- [ ] Bug fixes & code review

---

### TUDOR - Frontend & UI/UX

#### Ziua 1-2: Setup & Auth
- [ ] Inițializare React + Vite
- [ ] Setup TailwindCSS + shadcn/ui
- [ ] Configurare Supabase client
- [ ] Pagini: Login, Register
- [ ] Protected routes (HOC/guard)
- [ ] Layout cu navbar + sidebar

#### Ziua 3-4: Workflow UI & Dashboard
- [ ] Dashboard cu 3 variante (cetățean, funcționar, admin)
- [ ] **Funcționar Queue** - lista cereri assigned
- [ ] Workflow Timeline component (Stepper/Progress bar)
- [ ] Modal detalii cerere cu:
  - Toate fișierele atașate
  - Istoric workflow (cine, când, ce)
  - Semnături (cine a semnat)
- [ ] Upload form cetățean (depunere cerere)
- [ ] Acțiuni funcționar:
  - Buton "Sign Document"
  - Upload fișier suplimentar
  - "Send to Next Step"
  - "Reject" cu textarea motiv
- [ ] Status badges colorate pe stadiu

#### Ziua 5-6: Polish & Workflow Features
- [ ] Timeline vizuală pentru fiecare cerere (style Aceternity/shadcn)
- [ ] Activity log page (doar Admin) - toate acțiunile
- [ ] Statistici dashboard:
  - Charts: cereri pe stadiu (Recharts gratuit)
  - Timp mediu per stadiu
  - Bottlenecks (unde se blochează)
- [ ] Notificări toast (success/error la acțiuni)
- [ ] Loading states & error handling
- [ ] Responsive design (mobile queue pentru funcționari)
- [ ] Bug fixes & testing workflow complet

---

## GIT WORKFLOW

### Branches
```bash
main              # production-ready
├── dev           # development branch
    ├── feature/auth-claudiu
    ├── feature/documents-claudiu
    ├── feature/ui-tudor
    └── feature/dashboard-tudor
```

### Reguli
1. **NICIODATĂ** commit direct pe `main`
2. Pull Request (PR) înainte de merge în `dev`
3. Code review reciproc
4. Commit messages clare: `feat: add document upload` / `fix: login validation`
5. Sync zilnic: `git pull origin dev` dimineața

---

## PROVOCĂRI & BONUS

### Provocări Obligatorii
1. **Workflow engine** - tranziții corecte între stadii, validări
2. **RLS în Supabase** - configurare pe 5 roluri + workflow stages
3. **Multiple file upload** - validare, preview, tracking pe stadiu
4. **Digital signature** - simulare semnătură (text sau entry DB)
5. **Real-time updates** - queue se update-ază live când vine cerere nouă
6. **Timeline UI** - vizualizare clară istoric workflow

### Bonus (dacă rămâne timp)
- [ ] Email notifications când cerere ajunge în queue (Supabase Edge Functions)
- [ ] Preview PDF in-app (react-pdf sau iframe)
- [ ] Drag & drop upload
- [ ] Export raport workflow (CSV/PDF)
- [ ] Comments thread per cerere (chat intern între funcționari)
- [ ] Dark mode toggle
- [ ] SLA tracking (cerere depășește X zile în același stadiu → highlight red)
- [ ] Bulk actions (Admin assign multiple cereri simultan)

---

## CHECKLIST ZILNIC

### Daily Standup (15 min)
- Ce am făcut ieri?
- Ce fac azi?
- Sunt blocaje?

### End of Day
- Push code pe branch
- Update TODO-uri
- Comunică progres

---

## RESURSE UTILE

### Documentație
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [TailwindCSS](https://tailwindcss.com/docs)

### Tutoriale Supabase + React
- [Supabase Auth Tutorial](https://supabase.com/docs/guides/auth/auth-helpers/auth-ui)
- [File Upload Supabase](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Design Inspiration
- [Dribbble - Document Management](https://dribbble.com/search/document-management)
- [Behance - Admin Dashboards](https://www.behance.net/search/projects/admin%20dashboard)

---

## LIVRABILE FINALE

### Ziua 6 - Demo Ready
1. **Cod sursă** pe GitHub (repo public/privat)
2. **README.md** cu:
   - Setup instructions
   - Credențiale demo (3 useri: admin, angajat, cetățean)
   - Screenshots
3. **Deploy live:**
   - Frontend: [Vercel](https://vercel.com) / [Netlify](https://netlify.com)
   - Backend: Supabase (hosted)
4. **Video demo** (2-3 min) - walkthrough funcționalități

### Must-Have pentru Demo
- Login funcțional (toate 5 rolurile: cetățean, functionar_x, functionar_y, functionar_z, admin)
- **Flux complet cerere:**
  1. Cetățean depune →
  2. Funcționar X aprobă →
  3. Funcționar Y uploadează + semnează →
  4. Funcționar Z verifică + semnează →
  5. Cetățean descarcă
- Timeline vizuală per cerere
- Queue funcțional pentru fiecare funcționar
- Semnături vizibile pe documente
- Dashboard cu statistici workflow
- Mobile responsive (măcar queue-ul)

---

## CRITERII EVALUARE

| Criteriu | Punctaj |
|----------|---------|
| Funcționalitate completă (toate MVP features) | 40% |
| Code quality (clean, DRY, comentat) | 20% |
| UI/UX design (profesional, intuitiv) | 20% |
| Git workflow (commits, PR-uri, branches) | 10% |
| Documentație (README, comments) | 10% |

---

## TIMELINE VIZUAL

```
Ziua 1-2: Foundation
├─ Claudiu: DB schema (5 tabele) + Supabase setup + RLS
└─ Tudor: React setup + Auth UI + Layout

Ziua 3-4: Workflow Engine
├─ Claudiu: Workflow API (transitions, assign, signatures)
├─ Tudor: Queue UI + Timeline component + Actions
└─ Împreună: Testare flux cetățean → X → Y → Z

Ziua 5-6: Polish & Demo Prep
├─ Claudiu: Optimizations + edge cases
├─ Tudor: Dashboard stats + Timeline polish
└─ Împreună: End-to-end testing + deployment + video demo
```

---

**Succes și spor la lucru!** 🚀

*Proiect bazat pe cerințe reale din licitații primării românești - veți avea ceva solid în portofoliu!*
