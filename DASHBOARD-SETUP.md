# CHI admin portal — setup (about 10 minutes, free)

The admin portal lives at **yoursite.com/admin/**. Unlock it with your access code to:

- **Booking requests**: see every request from the schedule page, change its status (New, Contacted, Scheduled, Completed, Cancelled), keep private notes, search, and download a CSV.
- **Edit website**: change the text, phone number, photos, services, reviews and FAQ, with a live preview. Press **Save & publish** and the site updates within seconds, with no redeploy.

The website works normally before you do this setup. The portal just shows "Not connected yet" until it's done.

## 1. Create a free Supabase project

1. Go to supabase.com and sign up (no card needed).
2. Click **New project**. Give it a name like `chi-website`, set a database password (save it somewhere; you won't need it day to day), pick the region closest to Maryland (East US), and create it.

## 2. Create the tables

1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `supabase-setup.sql` from this folder, copy everything, paste it in and click **Run**.
3. You should see "Success. No rows returned".

## 3. Set your access code

1. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email: `anaamnizamii@gmail.com` (or change it, and change `adminEmail` in step 4 to match).
3. Password: **this is your access code.** Use at least 8 characters, ideally 12 or more, and not something guessable like the phone number.
4. Tick **Auto Confirm User** and create.
5. Then go to **Authentication** → **Sign In / Providers** and turn **off** "Allow new users to sign up", so this stays the only account.

To change the access code later, open that user in **Authentication → Users** and set a new password.

## 4. Connect the website

1. Click **Connect** in Supabase's top bar (or **Settings → API Keys**).
2. Copy the **Project URL** and the **publishable key** (`sb_publishable_…`; older projects call it "anon public").
3. Open `assets/cms-config.js` in this folder and paste them in place of `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`. Keep the quote marks.
4. **Never** paste the `service_role` / `sb_secret_…` key.
5. Redeploy the folder to Netlify.

## 5. Try it

1. Open yoursite.com/admin/ and enter your access code.
2. Submit a test request on yoursite.com/schedule/ and it appears under **Booking requests**.
3. Under **Edit website**, change something, watch the preview, and press **Save & publish**.

## Good to know

- **Netlify Forms still works.** Each booking request is also sent to Netlify as before, so you get Netlify's email notifications too.
- **Security.** The access code is checked by Supabase, not by the web page, so it can't be read from the page source. Visitors can send a request but can never read anyone else's. Your session stays unlocked until you press **Lock** or close the browser tab.
- **Free plan.** Supabase pauses free projects after about a week with no activity. Opening the admin portal or getting a booking keeps it active; if it ever pauses, click **Restore** in Supabase. While paused the website still shows its built-in content.
