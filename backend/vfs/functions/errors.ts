// We use 'any' here to avoid strict type dependency on the specific node_modules path
// which causes issues when backend/ is treated as a separate root.
// The error object from Supabase usually has code, message, details.

export class VFSError extends Error {
  originalError: any;
  code: string | null;
  details: string | null;

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'VFSError';
    this.originalError = originalError;
    this.code = originalError?.code || null;
    this.details = originalError?.details || originalError?.message || null;
  }
}

/**
 * Translates raw Supabase/PostgreSQL errors into user-friendly messages (Romanian).
 */
export const handleVFSError = (error: any, customMessage?: string): VFSError => {
  console.error("VFS Operation Failed:", error);

  // Default fallback
  let userMessage = customMessage || "A apărut o eroare neașteptată.";
  
  if (error?.code) {
    switch (error.code) {
      // Postgres Error Codes
      case '23505': // Unique violation
        if (error.message?.includes('folder_name_unique')) {
          userMessage = "Există deja un folder cu acest nume în această locație.";
        } else if (error.message?.includes('file_name_unique')) {
          userMessage = "Există deja un fișier cu acest nume în această locație.";
        } else {
          userMessage = "Există deja un element duplicat.";
        }
        break;
      
      case '23503': // Foreign key violation
        userMessage = "Operațiunea nu poate fi efectuată deoarece elementul referit nu există.";
        break;

      case '42P01': // Undefined table
        userMessage = "Eroare de sistem: Tabela solicitată nu există. Contactați administratorul.";
        break;
      
      case '42501': // Insufficient privilege (RLS)
        userMessage = "Nu aveți permisiunea necesară pentru a efectua această acțiune.";
        break;

      case 'PGRST116': // JSON result none (Single returned no rows)
        userMessage = "Elementul căutat nu a fost găsit.";
        break;
        
      case '23514': // Check violation
        userMessage = "Datele introduse nu respectă regulile de validare.";
        break;

      // Custom Supabase/Network codes
      case 'PGRST301': // JWT Expired or similar
        userMessage = "Sesiunea a expirat. Vă rugăm să vă autentificați din nou.";
        break;
        
      case 'TIMEOUT':
        userMessage = "Conexiunea la server a expirat. Verificați conexiunea la internet.";
        break;
    }
  }

  // Handle Storage API specific errors (often simple Error objects with messages)
  if (!error.code && error.message) {
    const msg = error.message.toLowerCase();
    if (msg.includes('duplicate')) userMessage = "Fișierul există deja.";
    if (msg.includes('unauthorized')) userMessage = "Nu aveți acces la acest fișier.";
    if (msg.includes('object not found')) userMessage = "Fișierul fizic nu a fost găsit.";
  }

  return new VFSError(userMessage, error);
};
