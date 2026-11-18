/* =============================================================================
   CHI dashboard — logic

   Talks to Supabase over plain REST (no SDK), so there is no CDN dependency
   and nothing to keep up to date. Three endpoints are used:

     POST {url}/auth/v1/token?grant_type=password   sign in
     GET/PATCH {url}/rest/v1/site_content           read and write the content
     POST {url}/storage/v1/object/site-images/...   image uploads

   The anon key below is public and read-only by design. Writing requires the
   access token returned by sign-in, and the database enforces that with row
   level security — so the password is checked by Supabase, not by this file.
============================================================================= */
(function () {
  "use strict";

  var CFG = window.CHI_CMS_CONFIG || {};
  var MAP = window.CHI_CMS_MAP || {};
  var BUCKET = "site-images";
  var TOKEN_KEY = "chi_admin_session";
  var EMAIL_KEY = "chi_admin_email";
  var EMAIL_PENDING_KEY = "chi_admin_email_pending";

  /* admin.js can be evaluated before the deferred map script. Always read the
     live objects before login, rendering, or a password change. */
  function syncConfig() {
    if (window.CHI_CMS_CONFIG && window.CHI_CMS_CONFIG.url) CFG = window.CHI_CMS_CONFIG;
    if (window.CHI_CMS_MAP && Object.keys(window.CHI_CMS_MAP).length) MAP = window.CHI_CMS_MAP;
  }

  var state = {
    content: null,   // working copy, reflects the form
    saved: null,     // last known server state, for "Undo changes"
    token: null,
    refresh: null,
    bookings: [],
    group: null,
    dirty: false
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------- path helpers */

  function get(obj, path) {
    var parts = String(path).split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function set(obj, path, value) {
    var parts = String(path).split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function mergeContent(base, over) {
    if (Array.isArray(over)) return clone(over);
    /* A blank saved value should not wipe the title and copy already on the site. */
    if (over === "" && typeof base === "string" && base !== "") return base;
    if (!over || typeof over !== "object") return over === undefined ? clone(base) : over;
    var out = base && typeof base === "object" && !Array.isArray(base) ? clone(base) : {};
    Object.keys(over).forEach(function (k) { out[k] = mergeContent(out[k], over[k]); });
    return out;
  }

  /* --------------------------------------------------------------- toast */

  var toastTimer = null;
  function toast(message, isError) {
    var el = $("toast");
    el.textContent = message;
    el.className = "toast" + (isError ? " error" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, isError ? 6000 : 2600);
  }

  /* ----------------------------------------------------------- supabase */

  function configured() {
    return CFG.url && CFG.anonKey && !/YOUR_/.test(CFG.url) && !/YOUR_/.test(CFG.anonKey);
  }

  function api(path) { return CFG.url.replace(/\/$/, "") + path; }

  function readBody(res) {
    return res.text().then(function (text) {
      if (!text) return {};
      try { return JSON.parse(text); }
      catch (e) { return { message: String(text).slice(0, 200) }; }
    });
  }

  function authFailure(body, fallback) {
    if (!body || typeof body !== "object") return fallback;
    var err = body.error;
    var nested = "";
    if (typeof err === "string") nested = err;
    else if (err && typeof err === "object") nested = err.message || err.msg || err.error_description || err.error_code || "";
    return body.error_description || body.msg || body.message || nested || body.error_code || fallback;
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function storedEmail(key) {
    try {
      var saved = normalizeEmail(localStorage.getItem(key));
      if (validEmail(saved)) return saved;
    } catch (e) {}
    return "";
  }

  function loginEmail() {
    syncConfig();
    return storedEmail(EMAIL_KEY) || normalizeEmail(CFG.adminEmail);
  }

  function showCurrentEmail() {
    var email = loginEmail() || "your admin account";
    ["settings-email", "settings-email-code"].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = email;
    });
  }

  function rememberEmail(email) {
    email = normalizeEmail(email);
    if (!validEmail(email)) return;
    try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
    if (storedEmail(EMAIL_PENDING_KEY) === email) {
      try { localStorage.removeItem(EMAIL_PENDING_KEY); } catch (e2) {}
    }
    showCurrentEmail();
  }

  function rememberPending(email) {
    email = normalizeEmail(email);
    if (!validEmail(email)) return;
    try { localStorage.setItem(EMAIL_PENDING_KEY, email); } catch (e) {}
  }

  /* The file still has the original email. A changed one is kept here and in
     site content so the next sign-in, on this computer or another, uses it. */
  function resolveLoginEmail() {
    syncConfig();
    var local = storedEmail(EMAIL_KEY);
    if (local) return Promise.resolve(local);
    return fetch(api("/rest/v1/site_content?select=content&id=eq.1"), {
      headers: { apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey }
    }).then(function (res) {
      return readBody(res).then(function (rows) {
        var saved = rows && rows[0] && rows[0].content && normalizeEmail(rows[0].content._adminEmail);
        if (validEmail(saved)) return saved;
        return normalizeEmail(CFG.adminEmail);
      });
    }).catch(function () { return normalizeEmail(CFG.adminEmail); });
  }

  function publishLoginEmail(email) {
    return authFetch("/rest/v1/site_content?select=content&id=eq.1").then(function (res) {
      if (!res.ok) throw new Error("Could not store the email");
      return res.json();
    }).then(function (rows) {
      if (!rows || !rows.length || !rows[0].content || typeof rows[0].content !== "object") return;
      var content = rows[0].content;
      if (content._adminEmail === email) return;
      content._adminEmail = email;
      if (state.content && typeof state.content === "object") state.content._adminEmail = email;
      if (state.saved && typeof state.saved === "object") state.saved._adminEmail = email;
      return saveContent(content);
    });
  }

  function requestToken(email, password) {
    return fetch(api("/auth/v1/token?grant_type=password"), {
      method: "POST",
      headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return readBody(res).then(function (body) { return { res: res, body: body }; });
    });
  }

  function acceptSession(body) {
    var email = normalizeEmail(body.user && body.user.email);
    var known = storedEmail(EMAIL_KEY) || normalizeEmail(CFG.adminEmail);
    if (validEmail(email)) rememberEmail(email);
    var session = { access: body.access_token, refresh: body.refresh_token };
    if (!validEmail(email) || email === known) return Promise.resolve(session);
    rememberSession(session);
    return publishLoginEmail(email).catch(function () {}).then(function () { return session; });
  }

  function signIn(password) {
    return resolveLoginEmail().then(function (email) {
      return requestToken(email, password).then(function (result) {
        if (result.res.ok && result.body.access_token) return acceptSession(result.body);
        var pending = storedEmail(EMAIL_PENDING_KEY);
        var failure = authFailure(result.body, "");
        if (pending && pending !== email && /invalid login|invalid_grant|invalid_credentials|credentials/i.test(failure)) {
          return requestToken(pending, password).then(function (second) {
            if (second.res.ok && second.body.access_token) return acceptSession(second.body);
            throw new Error(authFailure(result.body, "Sign-in failed"));
          });
        }
        throw new Error(authFailure(result.body, "Sign-in failed"));
      });
    });
  }

  /* Sessions from Supabase last an hour. Rather than kicking the user out
     mid-edit, a 401 triggers one silent refresh and the request is retried. */
  function refreshSession() {
    if (!state.refresh) return Promise.reject(new Error("expired"));
    return fetch(api("/auth/v1/token?grant_type=refresh_token"), {
      method: "POST",
      headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: state.refresh })
    }).then(function (res) {
      return readBody(res).then(function (body) {
        if (!res.ok || !body.access_token) throw new Error("expired");
        rememberSession({ access: body.access_token, refresh: body.refresh_token });
      });
    });
  }

  function rememberSession(session) {
    state.token = session.access;
    state.refresh = session.refresh || state.refresh;
    try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ access: state.token, refresh: state.refresh })); } catch (e) {}
  }

  function authFetch(path, options, retried) {
    options = options || {};
    var headers = Object.assign({ apikey: CFG.anonKey, Authorization: "Bearer " + state.token }, options.headers || {});
    return fetch(api(path), Object.assign({}, options, { headers: headers })).then(function (res) {
      if (res.status === 401 && !retried) {
        return refreshSession().then(
          function () { return authFetch(path, options, true); },
          function () { sessionExpired(); throw new Error("Your session has ended. Enter the access code again."); }
        );
      }
      return res;
    });
  }

  function sessionExpired() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    if (state.dirty) return; // keep unsaved work on screen; the next save shows the message
    $("app").hidden = true;
    $("login").hidden = false;
    showLoginError("Your session has ended. Enter the access code again.");
  }

  function loadContent() {
    return authFetch("/rest/v1/site_content?select=content&id=eq.1")
      .then(function (res) {
        if (!res.ok) throw new Error("Could not read the content table (HTTP " + res.status + ")");
        return res.json();
      })
      .then(function (rows) {
        if (rows && rows.length && rows[0].content) return rows[0].content;
        return null;
      });
  }

  function loadDefaults() {
    return fetch("../assets/content.default.json").then(function (r) { return r.json(); });
  }

  function saveContent(content) {
    return authFetch("/rest/v1/site_content?id=eq.1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ content: content, updated_at: new Date().toISOString() })
    }).then(function (res) {
      return res.text().then(function (text) {
        if (!res.ok) throw new Error(text || ("HTTP " + res.status));
        /* An empty array means the row is missing or RLS blocked the write. */
        var rows = text ? JSON.parse(text) : [];
        if (!rows.length) {
          throw new Error("Nothing was saved — check that row id = 1 exists in site_content.");
        }
        return rows[0];
      });
    });
  }

  function uploadImage(file) {
    var safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
    var key = Date.now() + "-" + safe;
    return authFetch("/storage/v1/object/" + BUCKET + "/" + key, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      },
      body: file
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("Upload failed: " + (t || res.status));
        });
      }
      return api("/storage/v1/object/public/" + BUCKET + "/" + key);
    });
  }

  /* ------------------------------------------------- booking requests */

  var STATUSES = [
    ["new", "New"], ["contacted", "Contacted"], ["scheduled", "Scheduled"],
    ["completed", "Completed"], ["cancelled", "Cancelled"]
  ];

  function esc(v) {
    return String(v === undefined || v === null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function loadBookings() {
    $("bookings-summary").textContent = "Loading…";
    return authFetch("/rest/v1/bookings?select=*&order=created_at.desc&limit=500")
      .then(function (res) {
        if (res.status === 404) throw new Error("The bookings table is not set up yet — run the updated supabase-setup.sql.");
        if (!res.ok) throw new Error("Could not load booking requests (HTTP " + res.status + ")");
        return res.json();
      })
      .then(function (rows) {
        state.bookings = rows || [];
        renderBookings();
      })
      .catch(function (err) {
        $("bookings-summary").textContent = err.message;
        $("booking-list").innerHTML = "";
      });
  }

  function updateBooking(id, patch) {
    return authFetch("/rest/v1/bookings?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch)
    }).then(function (res) {
      if (!res.ok) throw new Error("Could not update this request (HTTP " + res.status + ")");
      return res.json();
    });
  }

  function deleteBooking(id) {
    return authFetch("/rest/v1/bookings?id=eq." + encodeURIComponent(id), { method: "DELETE" })
      .then(function (res) { if (!res.ok) throw new Error("Could not delete (HTTP " + res.status + ")"); });
  }

  function fmtDate(value, withTime) {
    if (!value) return "";
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00" : value);
    if (isNaN(d)) return value;
    var opts = { month: "short", day: "numeric", year: "numeric" };
    if (withTime) { opts.hour = "numeric"; opts.minute = "2-digit"; }
    return d.toLocaleString(undefined, opts);
  }

  function visibleBookings() {
    var q = ($("booking-search").value || "").toLowerCase().trim();
    var f = $("booking-filter").value;
    return state.bookings.filter(function (b) {
      if (f !== "all" && (b.status || "new") !== f) return false;
      if (!q) return true;
      return [b.first_name, b.last_name, b.email, b.phone, b.address, b.city, b.zip]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderBookings() {
    var list = $("booking-list");
    var all = state.bookings;
    var fresh = all.filter(function (b) { return (b.status || "new") === "new"; }).length;
    var badge = $("new-count");
    badge.hidden = !fresh;
    badge.textContent = fresh;
    $("bookings-summary").textContent = all.length
      ? all.length + " request" + (all.length === 1 ? "" : "s") + " · " + fresh + " new"
      : "No booking requests yet. New requests from the schedule page appear here.";

    var rows = visibleBookings();
    if (!rows.length) {
      list.innerHTML = all.length ? '<p class="empty">No requests match this search.</p>' : "";
      return;
    }

    list.innerHTML = rows.map(function (b) {
      var name = esc(((b.first_name || "") + " " + (b.last_name || "")).trim() || "No name");
      var where = esc([b.address, b.city, (b.state || "").toUpperCase(), b.zip].filter(Boolean).join(", "));
      var services = (b.services || []).map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("");
      var status = b.status || "new";
      var options = STATUSES.map(function (s) {
        return '<option value="' + s[0] + '"' + (s[0] === status ? " selected" : "") + ">" + s[1] + "</option>";
      }).join("");
      return '<article class="booking status-' + esc(status) + '" data-id="' + esc(b.id) + '">' +
        '<div class="booking-main">' +
          '<div class="booking-title"><h3>' + name + '</h3><span class="received">Received ' + esc(fmtDate(b.created_at, true)) + "</span></div>" +
          '<p class="booking-where">' + (where || "No address given") + "</p>" +
          '<div class="booking-contact">' +
            (b.phone ? '<a href="tel:' + esc(String(b.phone).replace(/[^\d+]/g, "")) + '">' + esc(b.phone) + "</a>" : "") +
            (b.email ? '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + "</a>" : "") +
          "</div>" +
          '<dl class="booking-facts">' +
            "<div><dt>Preferred</dt><dd>" + esc(fmtDate(b.preferred_date)) + (b.preferred_time ? " · " + esc(b.preferred_time) : "") + "</dd></div>" +
            (b.property_type ? "<div><dt>Property</dt><dd>" + esc(b.property_type) + (b.square_feet ? " · " + esc(b.square_feet) + " sq ft" : "") + "</dd></div>" : "") +
          "</dl>" +
          (services ? '<div class="chips">' + services + "</div>" : "") +
          (b.message ? '<p class="booking-message">' + esc(b.message) + "</p>" : "") +
        "</div>" +
        '<div class="booking-side">' +
          '<label>Status<select data-status>' + options + "</select></label>" +
          '<label>Notes<textarea data-notes rows="3" placeholder="Private notes">' + esc(b.admin_notes || "") + "</textarea></label>" +
          '<button type="button" class="btn btn-danger" data-delete>Delete</button>' +
        "</div>" +
      "</article>";
    }).join("");
  }

  function findBooking(id) {
    for (var i = 0; i < state.bookings.length; i++) if (String(state.bookings[i].id) === String(id)) return state.bookings[i];
    return null;
  }

  function wireBookings() {
    var list = $("booking-list");
    list.addEventListener("change", function (e) {
      var card = e.target.closest(".booking");
      if (!card || !e.target.matches("[data-status]")) return;
      var b = findBooking(card.dataset.id);
      var value = e.target.value;
      updateBooking(card.dataset.id, { status: value })
        .then(function () { if (b) b.status = value; renderBookings(); toast("Status updated"); })
        .catch(function (err) { toast(err.message, true); renderBookings(); });
    });

    var noteTimers = {};
    list.addEventListener("input", function (e) {
      var card = e.target.closest(".booking");
      if (!card || !e.target.matches("[data-notes]")) return;
      var id = card.dataset.id;
      var value = e.target.value;
      clearTimeout(noteTimers[id]);
      noteTimers[id] = setTimeout(function () {
        updateBooking(id, { admin_notes: value })
          .then(function () { var b = findBooking(id); if (b) b.admin_notes = value; toast("Note saved"); })
          .catch(function (err) { toast(err.message, true); });
      }, 700);
    });

    list.addEventListener("click", function (e) {
      if (!e.target.matches("[data-delete]")) return;
      var card = e.target.closest(".booking");
      if (!confirm("Delete this booking request permanently?")) return;
      deleteBooking(card.dataset.id)
        .then(function () {
          state.bookings = state.bookings.filter(function (b) { return String(b.id) !== String(card.dataset.id); });
          renderBookings();
          toast("Request deleted");
        })
        .catch(function (err) { toast(err.message, true); });
    });

    $("booking-search").addEventListener("input", renderBookings);
    $("booking-filter").addEventListener("change", renderBookings);
    $("btn-refresh").addEventListener("click", loadBookings);
    $("btn-export").addEventListener("click", exportCsv);
  }

  function exportCsv() {
    var rows = visibleBookings();
    if (!rows.length) { toast("Nothing to export"); return; }
    var cols = ["created_at", "status", "first_name", "last_name", "phone", "email", "address", "city", "state", "zip",
                "property_type", "square_feet", "services", "preferred_date", "preferred_time", "message", "admin_notes"];
    var cell = function (v) {
      if (Array.isArray(v)) v = v.join("; ");
      v = v === undefined || v === null ? "" : String(v);
      if (/^[=+\-@]/.test(v)) v = "'" + v; // stop spreadsheet formula injection
      return '"' + v.replace(/"/g, '""') + '"';
    };
    var csv = [cols.join(",")].concat(rows.map(function (r) {
      return cols.map(function (c) { return cell(r[c]); }).join(",");
    })).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chi-booking-requests-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ------------------------------------------------------- change password */

  function changePassword(currentPassword, nextPassword) {
    return signIn(currentPassword).then(function (session) {
      rememberSession(session);
      return authFetch("/auth/v1/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: nextPassword })
      });
    }).then(function (res) {
      return readBody(res).then(function (body) {
        if (!res.ok) throw new Error(authFailure(body, "Could not change the access code"));
      });
    });
  }

  function changeEmail(password, nextEmail) {
    nextEmail = normalizeEmail(nextEmail);
    return signIn(password).then(function (session) {
      rememberSession(session);
      return authFetch("/auth/v1/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail })
      });
    }).then(function (res) {
      return readBody(res).then(function (body) {
        if (!res.ok) throw new Error(authFailure(body, "Could not change the email"));
        var active = normalizeEmail(body.email || (body.user && body.user.email));
        var pending = normalizeEmail(body.new_email || (body.user && body.user.new_email));
        if (active === nextEmail) {
          rememberEmail(nextEmail);
          return publishLoginEmail(nextEmail).catch(function () {}).then(function () {
            return { confirmed: true };
          });
        }
        rememberPending(pending || nextEmail);
        return { confirmed: false };
      });
    });
  }

  function wireEmail() {
    showCurrentEmail();
    var form = $("email-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var next = normalizeEmail($("email-new").value);
      var confirm = normalizeEmail($("email-confirm").value);
      var password = $("email-password").value;
      var error = $("email-error");
      var btn = $("email-save");
      error.hidden = true;
      if (!validEmail(next)) {
        error.textContent = "Enter a valid email address.";
        error.hidden = false;
        return;
      }
      if (next !== confirm) {
        error.textContent = "The email addresses do not match.";
        error.hidden = false;
        return;
      }
      if (next === loginEmail()) {
        error.textContent = "That is already the current email.";
        error.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.textContent = "Updating…";
      changeEmail(password, next)
        .then(function (result) {
          form.reset();
          showCurrentEmail();
          if (result && result.confirmed) toast("Email updated");
          else toast("Confirmation link sent. Open it in the new inbox, then sign in with that email.");
        })
        .catch(function (err) {
          var msg = /invalid login|invalid_grant|invalid_credentials|credentials/i.test(err && err.message || "")
            ? "The current access code is not right."
            : (err && err.message) || "Could not change the email.";
          error.textContent = msg;
          error.hidden = false;
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "Update email";
        });
    });
  }

  function wirePassword() {
    showCurrentEmail();
    var form = $("password-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var current = $("pw-current").value;
      var next = $("pw-new").value;
      var confirm = $("pw-confirm").value;
      var error = $("pw-error");
      var btn = $("pw-save");
      error.hidden = true;
      if (next.length < 8) {
        error.textContent = "Use at least 8 characters.";
        error.hidden = false;
        return;
      }
      if (next !== confirm) {
        error.textContent = "The new access codes do not match.";
        error.hidden = false;
        return;
      }
      if (next === current) {
        error.textContent = "Choose a different access code from the current one.";
        error.hidden = false;
        return;
      }
      btn.disabled = true;
      btn.textContent = "Updating…";
      changePassword(current, next)
        .then(function () {
          form.reset();
          toast("Access code updated");
        })
        .catch(function (err) {
          var msg = /invalid login|invalid_grant|invalid_credentials|credentials/i.test(err && err.message || "")
            ? "The current access code is not right."
            : (err && err.message) || "Could not change the access code.";
          error.textContent = msg;
          error.hidden = false;
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "Update access code";
        });
    });
  }

  /* ---------------------------------------------------------------- tabs */

  function showTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
    $("view-bookings").hidden = name !== "bookings";
    $("view-content").hidden = name !== "content";
    $("view-settings").hidden = name !== "settings";
    document.body.classList.toggle("on-content", name === "content");
    if (name === "bookings") loadBookings();
  }

  /* --------------------------------------------------------- dirty state */

  function markDirty(dirty) {
    state.dirty = dirty;
    $("btn-save").disabled = !dirty;
    var label = $("save-state");
    label.textContent = dirty ? "Unsaved changes" : "All changes saved";
    label.className = dirty ? "dirty" : "";
  }

  window.addEventListener("beforeunload", function (event) {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  /* ------------------------------------------------------------ preview */

  var previewTimer = null;
  function pushPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      var frame = $("preview-frame");
      if (!frame || !frame.contentWindow) return;
      frame.contentWindow.postMessage(
        { type: "chi-cms-preview", content: state.content }, window.location.origin
      );
    }, 120);
  }

  /* ------------------------------------------------------- field builders */

  function fieldShell(labelText, hint) {
    var wrap = document.createElement("div");
    wrap.className = "field";
    var label = document.createElement("label");
    label.textContent = labelText;
    wrap.appendChild(label);
    if (hint) {
      var h = document.createElement("p");
      h.className = "hint";
      h.textContent = hint;
      wrap.dataset.hint = "1";
      wrap._hint = h;
    }
    return wrap;
  }

  function onEdit(path, value) {
    set(state.content, path, value);
    markDirty(true);
    pushPreview();
  }

  function plainFromStyled(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/em>/gi, "")
      .replace(/<em>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function styledFromPlain(value, mode) {
    var lines = String(value || "").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    if (lines.length < 2 && mode === "em" && lines[0]) {
      var m = lines[0].match(/^(.+?[.!?])\s+(.+)$/);
      if (m) lines = [m[1], m[2]];
    }
    if (!lines.length) return "";
    if (lines.length < 2) return esc(lines[0]);
    if (mode === "em") return esc(lines[0]) + " <em>" + esc(lines.slice(1).join(" ")) + "</em>";
    return lines.map(esc).join("<br />");
  }

  function buildText(path, def) {
    var wrap = fieldShell(def.label, def.hint);
    var multiline = def.multiline || !!def.splitStyle;
    var el = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) el.type = "text";
    var current = get(state.content, path);
    if (current === undefined || current === null) current = "";
    el.value = def.splitStyle ? plainFromStyled(current) : current;
    el.addEventListener("input", function () {
      onEdit(path, def.splitStyle ? styledFromPlain(el.value, def.splitStyle) : el.value);
    });
    wrap.appendChild(el);
    if (wrap._hint) wrap.appendChild(wrap._hint);
    return wrap;
  }

  function buildStars(path, def) {
    var wrap = fieldShell(def.label, def.hint);
    var el = document.createElement("select");
    [5, 4, 3, 2, 1].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = "★★★★★".slice(0, n);
      opt.textContent = opt.value + "  (" + n + ")";
      el.appendChild(opt);
    });
    el.value = get(state.content, path) || "★★★★★";
    el.addEventListener("change", function () { onEdit(path, el.value); });
    wrap.appendChild(el);
    return wrap;
  }

  function buildList(path, def) {
    /* a simple one-per-line editor for string arrays (service bullet points) */
    var wrap = fieldShell(def.label, "One per line");
    var el = document.createElement("textarea");
    var arr = get(state.content, path);
    el.value = Array.isArray(arr) ? arr.join("\n") : "";
    el.addEventListener("input", function () {
      onEdit(path, el.value.split("\n").map(function (s) { return s.trim(); })
        .filter(function (s) { return s !== ""; }));
    });
    wrap.appendChild(el);
    if (wrap._hint) wrap.appendChild(wrap._hint);
    return wrap;
  }

  /* Image values can be a short relative path, a long Supabase URL, or (in the
     demo build) a base64 data URI thousands of characters long. Show something
     readable instead of dumping the raw value under the thumbnail. */
  function displayPath(value) {
    if (!value) return "";
    if (/^data:/.test(value)) return "Uploaded image";
    var clean = String(value).split("?")[0];
    var name = clean.substring(clean.lastIndexOf("/") + 1);
    return name.length > 48 ? name.slice(0, 45) + "…" : name;
  }

  function resolvePreviewSrc(value) {
    if (!value) return "";
    if (/^https?:|^data:/.test(value)) return value;
    return "../" + value.replace(/^\.\//, "");
  }

  function buildImage(path, def) {
    var wrap = fieldShell(def.label, def.hint);
    var row = document.createElement("div");
    row.className = "image-field";

    var thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.alt = "";
    thumb.src = resolvePreviewSrc(get(state.content, path));

    var actions = document.createElement("div");
    actions.className = "image-actions";

    var file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";

    var pick = document.createElement("button");
    pick.type = "button";
    pick.className = "btn btn-ghost";
    pick.textContent = "Upload new image";
    pick.addEventListener("click", function () { file.click(); });

    var status = document.createElement("p");
    status.className = "path";
    status.textContent = displayPath(get(state.content, path));
    status.title = get(state.content, path) || "";

    file.addEventListener("change", function () {
      var chosen = file.files && file.files[0];
      if (!chosen) return;
      if (chosen.size > 5 * 1024 * 1024) {
        toast("That image is over 5 MB — please use a smaller one.", true);
        file.value = "";
        return;
      }
      status.className = "uploading";
      status.textContent = "Uploading " + chosen.name + "…";
      uploadImage(chosen)
        .then(function (url) {
          onEdit(path, url);
          thumb.src = url;
          status.className = "path";
          status.textContent = displayPath(url);
          status.title = url;
          toast("Image uploaded");
        })
        .catch(function (err) {
          status.className = "path";
          status.textContent = displayPath(get(state.content, path));
          toast(err.message, true);
        })
        .then(function () { file.value = ""; });
    });

    actions.appendChild(pick);
    actions.appendChild(file);
    actions.appendChild(status);
    row.appendChild(thumb);
    row.appendChild(actions);
    wrap.appendChild(row);
    if (wrap._hint) wrap.appendChild(wrap._hint);
    return wrap;
  }

  function buildField(path, def) {
    if (!def) return document.createElement("div");
    if (def.type === "image") return buildImage(path, def);
    if (def.type === "stars") return buildStars(path, def);
    if (def.type === "datalist") return buildList(path, def);
    return buildText(path, def);
  }

  /* --------------------------------------------------------- list editor */

  function buildDynamic(group, host) {
    var def = group.dynamic;
    var list = get(state.content, def.key);
    if (!Array.isArray(list)) { list = []; set(state.content, def.key, list); }

    list.forEach(function (row, index) {
      var card = document.createElement("div");
      card.className = "card";

      var head = document.createElement("div");
      head.className = "card-head";
      var title = document.createElement("h3");
      title.textContent = (group.label || "Item") + " " + (index + 1);
      var tools = document.createElement("div");
      tools.className = "row-tools";

      function toolBtn(label, title2, disabled, fn) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.title = title2;
        b.disabled = disabled;
        b.addEventListener("click", fn);
        return b;
      }

      tools.appendChild(toolBtn("↑", "Move up", index === 0, function () {
        list.splice(index - 1, 0, list.splice(index, 1)[0]);
        markDirty(true); pushPreview(); renderGroup(state.group);
      }));
      tools.appendChild(toolBtn("↓", "Move down", index === list.length - 1, function () {
        list.splice(index + 1, 0, list.splice(index, 1)[0]);
        markDirty(true); pushPreview(); renderGroup(state.group);
      }));
      tools.appendChild(toolBtn("✕", "Delete", false, function () {
        if (!confirm("Delete this entry? It will disappear from the site when you save.")) return;
        list.splice(index, 1);
        markDirty(true); pushPreview(); renderGroup(state.group);
      }));

      head.appendChild(title);
      head.appendChild(tools);
      card.appendChild(head);

      def.fields.forEach(function (f) {
        card.appendChild(buildField(def.key + "." + index + "." + f.k, f));
      });

      host.appendChild(card);
    });

    var add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-ghost";
    add.textContent = "+ Add another";
    add.addEventListener("click", function () {
      var row = {};
      def.fields.forEach(function (f) { row[f.k] = f.default !== undefined ? f.default : ""; });
      list.push(row);
      markDirty(true); pushPreview(); renderGroup(state.group);
    });
    host.appendChild(add);
  }

  /* -------------------------------------------------------------- render */

  function renderSidebar() {
    syncConfig();
    var nav = $("sidebar");
    nav.innerHTML = "";
    Object.keys(MAP).forEach(function (key) {
      var group = MAP[key];
      if (!group) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = group.label || key;
      btn.className = key === state.group ? "active" : "";
      btn.addEventListener("click", function () {
        state.group = key;
        renderSidebar();
        renderGroup(key);
        $("editor").scrollTop = 0;
      });
      nav.appendChild(btn);
    });
  }

  function renderGroup(key) {
    syncConfig();
    var group = MAP[key];
    var host = $("editor");
    if (!host) return;
    host.innerHTML = "";
    if (!group) return;

    var h = document.createElement("h2");
    h.textContent = group.label || "";
    host.appendChild(h);

    var hint = document.createElement("p");
    hint.className = "section-hint";
    hint.textContent = group.page === "home"
      ? "Appears on the homepage."
      : "Appears on every page.";
    host.appendChild(hint);

    (group.fields || []).forEach(function (f) {
      host.appendChild(buildField(f.path, f));
    });

    if (group.repeat && group.repeatFields) {
      for (var i = 0; i < group.repeat.count; i++) {
        var card = document.createElement("div");
        card.className = "card";
        var t = document.createElement("h3");
        t.textContent = "Item " + (i + 1);
        card.appendChild(t);
        /* eslint-disable no-loop-func */
        (function (index) {
          group.repeatFields.forEach(function (f) {
            card.appendChild(buildField(f.path.replace("#", String(index)), f));
          });
        })(i);
        host.appendChild(card);
      }
    }

    if (group.items) {
      group.items.ids.forEach(function (id) {
        var card = document.createElement("div");
        card.className = "card";
        var t = document.createElement("h3");
        var named = get(state.content, group.items.key + "." + id + ".title");
        t.textContent = named || id;
        card.appendChild(t);
        group.items.fields.forEach(function (f) {
          card.appendChild(buildField(group.items.key + "." + id + "." + f.k, f));
        });
        host.appendChild(card);
      });
    }

    if (group.regions) {
      group.regions.ids.forEach(function (id) {
        var card = document.createElement("div");
        card.className = "card";
        var t = document.createElement("h3");
        t.textContent = get(state.content, group.regions.key + "." + id + ".name") || id;
        card.appendChild(t);
        group.regions.fields.forEach(function (f) {
          card.appendChild(buildField(group.regions.key + "." + id + "." + f.k, f));
        });
        host.appendChild(card);
      });
    }

    if (group.dynamic) buildDynamic(group, host);
  }

  /* ---------------------------------------------------------- app start */

  function startApp(content) {
    syncConfig();
    state.content = clone(content);
    state.saved = clone(content);
    state.group = Object.keys(MAP)[0];
    if (!state.group || !MAP[state.group]) {
      throw new Error("The editor did not load. Refresh the page and try again.");
    }
    $("login").hidden = true;
    $("app").hidden = false;
    showTab("bookings");
    renderSidebar();
    renderGroup(state.group);
    markDirty(false);

    var frame = $("preview-frame");
    frame.addEventListener("load", pushPreview);
    pushPreview();
  }

  /* ------------------------------------------------------------- wiring */

  function wireChrome() {
    $("btn-save").addEventListener("click", function () {
      var btn = $("btn-save");
      btn.disabled = true;
      btn.textContent = "Saving…";
      saveContent(state.content)
        .then(function () {
          state.saved = clone(state.content);
          markDirty(false);
          toast("Saved — the website is updated");
        })
        .catch(function (err) {
          markDirty(true);
          toast(err.message, true);
        })
        .then(function () { btn.textContent = "Save & publish"; });
    });

    $("btn-revert").addEventListener("click", function () {
      if (!state.dirty) { toast("Nothing to undo"); return; }
      if (!confirm("Discard all changes since your last save?")) return;
      state.content = clone(state.saved);
      renderGroup(state.group);
      markDirty(false);
      pushPreview();
      toast("Changes discarded");
    });

    $("btn-logout").addEventListener("click", function () {
      if (state.dirty && !confirm("You have unsaved changes. Sign out anyway?")) return;
      try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
      state.dirty = false;
      location.reload();
    });

    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { showTab(t.dataset.tab); });
    });
    wireBookings();
    wireEmail();
    wirePassword();

    $("btn-preview-toggle").addEventListener("click", function () {
      var layout = document.querySelector(".layout");
      var off = layout.classList.toggle("no-preview");
      this.textContent = off ? "Show preview" : "Hide preview";
    });

    document.querySelectorAll(".preview-sizes button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".preview-sizes button").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        $("frame-wrap").classList.toggle("mobile", btn.dataset.size === "mobile");
      });
    });
  }

  function boot(session) {
    rememberSession(session);
    Promise.all([loadContent(), loadDefaults()])
      .then(function (both) {
        /* The saved content is layered over the site's built-in content, so
           on first run (empty row) and for any field added later, the editor
           shows what the website currently says instead of a blank box. */
        var saved = both[0] && typeof both[0] === "object" ? both[0] : {};
        if (!Object.keys(saved).length) toast("Starting from the current website content");
        return mergeContent(both[1] || {}, saved);
      })
      .then(startApp)
      .catch(function (err) {
        $("login").hidden = false;
        $("app").hidden = true;
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
        showLoginError(err.message);
      });
  }

  function showLoginError(message) {
    var el = $("login-error");
    el.textContent = message;
    el.hidden = false;
  }

  function init() {
    syncConfig();
    wireChrome();

    if (!configured()) {
      $("login-form").querySelector("button").disabled = true;
      showLoginError("Not connected yet. Add your Supabase details to assets/cms-config.js and redeploy (see DASHBOARD-SETUP.md).");
      return;
    }

    $("login-form").addEventListener("submit", function (event) {
      event.preventDefault();
      $("login-error").hidden = true;
      var btn = $("login-btn");
      btn.disabled = true;
      btn.textContent = "Checking…";
      signIn($("password").value)
        .then(boot)
        .catch(function (err) {
          var msg = /invalid login|invalid_grant|invalid_credentials|credentials/i.test(err && err.message || "")
            ? "That access code is not right. Try again."
            : (err && err.message) || "Sign-in failed";
          showLoginError(msg);
          $("password").select();
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = "Unlock";
        });
    });

    var existing = null;
    try { existing = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null"); } catch (e) {}
    if (existing && existing.access) boot(existing);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
