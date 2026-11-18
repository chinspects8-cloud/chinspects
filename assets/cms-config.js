/* =============================================================================
   CHI admin portal — connection settings

   Paste the two values from your Supabase project here, then redeploy once.
   After that, everything is managed from yoursite.com/admin/ — this file
   never needs to change again.

   Where to find them (Supabase dashboard -> your project):
     click "Connect" in the top bar, or Settings -> API Keys
       url     = Project URL, e.g. https://abcdefgh.supabase.co
       anonKey = the publishable key ("sb_publishable_...")
                 (older projects show "anon public", starting "eyJ...")

   The publishable key is MEANT to be public. It only lets visitors read the
   website text and send a booking request. Changing content, uploading images
   and seeing booking requests all require the access code, and the database
   itself enforces that (row level security) — not this file.

   NEVER paste the "service_role" / "sb_secret_..." key here.
============================================================================= */
window.CHI_CMS_CONFIG = {
  url: "https://rjzlxlcxukghspdcdwxf.supabase.co",
  anonKey: "sb_publishable_-lggUqBXUXenCnu51B4C1g_pWfvk2Iw",

  /* The admin user's email from Supabase -> Authentication -> Users.
     The portal only asks for the access code (that user's password). */
  adminEmail: "tekbis01@gmail.com"
};
