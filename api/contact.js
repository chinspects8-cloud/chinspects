const TO = "ken@chinspects.com";

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function clean(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const data = readBody(req);
  if (clean(data.botField || data["bot-field"])) {
    res.status(200).json({ ok: true });
    return;
  }

  const firstName = clean(data.firstName, 120);
  const lastName = clean(data.lastName, 120);
  const email = clean(data.email, 254);
  const zip = clean(data.zip, 20);
  const phone = clean(data.phone, 40);
  const capital = clean(data.capital, 500);

  if (!firstName || !lastName || !email || !zip || !capital) {
    res.status(400).json({ ok: false, error: "Missing required fields" });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "Invalid email" });
    return;
  }

  const payload = {
    _subject: "New message from the CHI contact form",
    _template: "table",
    _captcha: "false",
    _replyto: email,
    "First name": firstName,
    "Last name": lastName,
    Email: email,
    "Zip code": zip,
    Phone: phone,
    "Capital for investment": capital
  };

  try {
    const upstream = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(TO), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.chinspects.com",
        Referer: "https://www.chinspects.com/contact.html"
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = null; }

    if (!upstream.ok || (body && String(body.success) === "false")) {
      res.status(502).json({
        ok: false,
        error: (body && body.message) || "Email delivery failed"
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({ ok: false, error: "Email delivery failed" });
  }
};
