(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const serviceContent = {
    home: {
      kicker: "Complete property view",
      title: "Comprehensive home inspection",
      copy: "A complete system-by-system evaluation using modern tools, color photos and a clear digital report.",
      points: ["Roof to foundation", "Major systems & safety", "Clear digital report"],
      alt: "CHI inspector pointing out a home's roof and exterior details"
    },
    radon: {
      kicker: "Measure what you cannot see",
      title: "Radon testing",
      copy: "Professional monitoring provides clear results and practical context for an invisible concern that cannot be judged by sight or smell.",
      points: ["Modern monitoring equipment", "Easy-to-read results", "Coordinated with your inspection"],
      alt: "CHI inspector setting up a radon monitor in a finished basement"
    },
    mold: {
      kicker: "Trace the source",
      title: "Mold & moisture testing",
      copy: "Targeted evaluation focuses on visible concerns, moisture-prone areas and conditions that may deserve closer attention.",
      points: ["Moisture-meter screening", "Concern-focused assessment", "Photo documentation"],
      alt: "CHI inspector checking a bathroom wall with a moisture meter"
    },
    water: {
      kicker: "Understand household water",
      title: "Water quality testing",
      copy: "Choose practical screening options for private wells and household water, coordinated with your property inspection.",
      points: ["Convenient sample collection", "Clear test options", "Coordinated scheduling"],
      alt: "CHI inspector collecting a residential water sample at a kitchen faucet"
    },
    termite: {
      kicker: "Specialist support",
      title: "Termite inspection",
      copy: "An experienced termite inspector evaluates accessible areas for visible evidence and conditions associated with wood-destroying insects.",
      points: ["Specialist on staff", "Visible evidence review", "Combined appointment option"],
      alt: "CHI inspector checking a basement sill plate for termite evidence"
    },
    thermal: {
      kicker: "Technology that adds perspective",
      title: "Thermal imaging",
      copy: "Infrared tools help identify temperature patterns that can guide a closer look at electrical, moisture or insulation concerns.",
      points: ["Infrared scanning", "Temperature anomaly review", "Images in your report"],
      alt: "CHI inspector scanning an electrical panel with a thermal camera"
    }
  };

  const regionNames = {
    md: "Maryland",
    pa: "Pennsylvania",
    dc: "Washington, DC",
    wv: "West Virginia"
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character]);

  /* ---------------------------------------------------------------- CMS
     Service panel copy and region names live in this file, so the admin
     portal overrides them through this hook. Objects are mutated in place
     because the closures below already hold references to them. */
  const contentHooks = [];
  let regionLabelPrefix = "Serving";

  const applyCmsContent = (content) => {
    if (!content) return;
    const items = content.services && content.services.items;
    if (items) {
      Object.keys(items).forEach((key) => {
        const target = serviceContent[key];
        const source = items[key];
        if (!target || !source) return;
        if (source.kicker !== undefined) target.kicker = source.kicker;
        if (source.panelTitle !== undefined) target.title = source.panelTitle;
        if (source.copy !== undefined) target.copy = source.copy;
        if (source.alt !== undefined) target.alt = source.alt;
        if (Array.isArray(source.points)) target.points = source.points;
      });
    }
    if (content.area && content.area.statusPrefix !== undefined) regionLabelPrefix = content.area.statusPrefix;
    const regions = content.area && content.area.regions;
    if (regions) {
      Object.keys(regions).forEach((key) => {
        if (regions[key] && regions[key].name) regionNames[key] = regions[key].name;
      });
    }
    contentHooks.forEach((hook) => { try { hook(); } catch (error) { /* keep going */ } });
  };

  const setYears = () => {
    document.querySelectorAll("[data-year]").forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  };

  const initHeader = () => {
    const header = document.querySelector("[data-header]");
    const toggle = document.querySelector(".menu-toggle");
    if (!header) return;

    let ticking = false;
    let lastY = window.scrollY;
    const updateHeader = () => {
      const y = window.scrollY;
      header.classList.toggle("scrolled", y > 28);
      // Tuck the header away while reading down the page, bring it back on any upward scroll.
      const menuOpen = document.body.classList.contains("menu-open");
      header.classList.toggle("is-tucked", !menuOpen && y > 520 && y > lastY + 4);
      if (y < lastY - 4 || y <= 520) header.classList.remove("is-tucked");
      lastY = y;
      ticking = false;
    };
    updateHeader();
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
    }, { passive: true });

    if (toggle) {
      toggle.addEventListener("click", () => {
        const open = document.body.classList.toggle("menu-open");
        toggle.setAttribute("aria-expanded", String(open));
      });

      document.querySelectorAll("#primary-nav a, .header-cta, .header-call, .header-call-mini, .phone-link").forEach((link) => {
        link.addEventListener("click", () => {
          document.body.classList.remove("menu-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }
  };

  const initLimelightNav = () => {
    document.querySelectorAll(".limelight-nav").forEach((nav) => {
      const light = nav.querySelector(".nav-light");
      const links = [...nav.querySelectorAll("a")];
      if (!light || !links.length) return;

      let selected = nav.querySelector("a.active");

      const moveTo = (link) => {
        if (window.innerWidth <= 980) return;
        if (!link) {
          light.style.opacity = "0";
          return;
        }
        const navBox = nav.getBoundingClientRect();
        const box = link.getBoundingClientRect();
        light.style.opacity = "1";
        light.style.width = `${box.width}px`;
        light.style.transform = `translateX(${box.left - navBox.left - 5}px)`;
      };

      links.forEach((link) => {
        link.addEventListener("pointerenter", () => moveTo(link));
        link.addEventListener("focus", () => moveTo(link));
        link.addEventListener("click", () => {
          selected?.classList.remove("active");
          selected = link;
          selected.classList.add("active");
          moveTo(selected);
        });
      });

      nav.addEventListener("pointerleave", () => moveTo(selected));
      window.addEventListener("resize", () => moveTo(selected), { passive: true });
      requestAnimationFrame(() => moveTo(selected));
    });
  };

  let revealObserver = null;
  const observeReveal = (elements) => {
    [...elements].forEach((el) => {
      if (!el.classList.contains("reveal")) return;
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add("is-visible");
    });
  };

  const initReveal = () => {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.13, rootMargin: "0px 0px -45px" });
    revealObserver = observer;

    items.forEach((item) => observer.observe(item));
  };

  const initHero = () => {
    const root = document.querySelector("[data-hero-slider]");
    if (!root) return;

    const slides = [...root.querySelectorAll("[data-hero-slide]")];
    const controls = [...root.querySelectorAll("[data-hero-step]")];
    let current = 0;
    let timer;

    const show = (next) => {
      current = (next + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        const active = index === current;
        slide.classList.toggle("active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      controls.forEach((control, index) => {
        const active = index === current;
        control.classList.toggle("active", active);
        control.setAttribute("aria-pressed", String(active));
      });
    };

    const start = () => {
      if (reduceMotion) return;
      window.clearInterval(timer);
      timer = window.setInterval(() => show(current + 1), 5600);
    };

    controls.forEach((control, index) => {
      control.addEventListener("click", () => {
        show(index);
        start();
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) window.clearInterval(timer);
      else start();
    });

    show(0);
    start();
  };

  const initInteractiveServices = () => {
    const root = document.querySelector("[data-interactive-list]");
    if (!root) return;

    const rows = [...root.querySelectorAll(".service-row")];
    const previewImages = [...root.querySelectorAll("[data-preview-image]")];
    const previewKicker = root.querySelector("[data-preview-kicker]");
    const previewTitle = root.querySelector("[data-preview-title]");
    const previewCopy = root.querySelector("[data-preview-copy]");
    const previewPoints = root.querySelector("[data-preview-points]");
    let activeRow = rows[0];

    const activate = (row) => {
      if (!row || row === activeRow && row.classList.contains("active")) return;
      activeRow = row;
      rows.forEach((item) => {
        const active = item === row;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });

      const key = row.dataset.service;
      const content = serviceContent[key];
      if (!content) return;

      previewImages.forEach((image) => image.classList.toggle("active", image.dataset.previewImage === key));
      if (previewKicker) previewKicker.textContent = content.kicker;
      if (previewTitle) previewTitle.textContent = content.title;
      if (previewCopy) previewCopy.textContent = content.copy;
      if (previewPoints) previewPoints.innerHTML = content.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
    };

    contentHooks.push(() => {
      const row = activeRow;
      activeRow = null;
      activate(row);
    });

    rows.forEach((row) => {
      row.addEventListener("pointerenter", () => activate(row));
      row.addEventListener("focus", () => activate(row));
      row.addEventListener("click", () => activate(row));
      row.addEventListener("keydown", (event) => {
        if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        const index = rows.indexOf(row);
        const next = event.key === "ArrowDown" ? (index + 1) % rows.length : (index - 1 + rows.length) % rows.length;
        rows[next].focus();
      });
    });

  };

  const setRegion = (region) => {
    if (!regionNames[region]) return;
    document.querySelectorAll("[data-region]").forEach((node) => {
      node.classList.toggle("active", node.dataset.region === region);
    });
    document.querySelectorAll("[data-region-label]").forEach((node) => {
      const inBooking = node.closest(".booking-map");
      const prefix = inBooking || !regionLabelPrefix ? "" : regionLabelPrefix + " ";
      const suffix = inBooking ? " selected" : "";
      node.textContent = `${prefix}${regionNames[region]}${suffix}`;
    });

    const select = document.querySelector("[data-state-select]");
    if (select && select.value !== region) select.value = region;
    const summary = document.querySelector("[data-summary-location]");
    if (summary) summary.textContent = regionNames[region];
    document.dispatchEvent(new CustomEvent("chi:regionchange", { detail: { region } }));
  };

  const initRegionMaps = () => {
    document.querySelectorAll("[data-region]").forEach((control) => {
      control.addEventListener("click", () => setRegion(control.dataset.region));
    });

    contentHooks.push(() => {
      const active = document.querySelector(".area-pills button.active, .map-node.active");
      if (active && active.dataset.region) setRegion(active.dataset.region);
    });

    const select = document.querySelector("[data-state-select]");
    select?.addEventListener("change", () => setRegion(select.value));
  };

  const initLiveServiceMap = () => {
    const canvas = document.querySelector("#service-area-map");
    if (!canvas) return;
    const mapShell = canvas.closest("[data-map-shell]");
    const retryButton = mapShell?.querySelector("[data-retry-live-map]");

    const regions = {
      md: { name: "Maryland", center: [39.05, -76.65], zoom: 8 },
      pa: { name: "Pennsylvania", center: [40.82, -77.75], zoom: 7 },
      dc: { name: "Washington, DC", center: [38.907, -77.037], zoom: 11 },
      wv: { name: "West Virginia", center: [38.55, -80.45], zoom: 7 }
    };

    if (canvas.dataset.leafletMap !== undefined && window.L) {
      const map = window.L.map(canvas, {
        center: regions.md.center,
        zoom: regions.md.zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
        preferCanvas: true
      });
      const tiles = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        minZoom: 5,
        subdomains: "abc",
        attribution: "&copy; OpenStreetMap contributors",
        crossOrigin: true,
        keepBuffer: 4,
        updateWhenIdle: true
      }).addTo(map);

      const marker = window.L.marker(regions.md.center, {
        icon: window.L.divIcon({
          className: "chi-live-marker",
          html: "<span></span>",
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }),
        keyboard: false
      }).addTo(map);

      // Real outlines of the four service regions, drawn over the street map.
      const shapes = window.CHI_STATES;
      let activeKey = "md";
      const shapeStyle = (active) => ({
        color: active ? "#0457d6" : "#0878f9",
        weight: active ? 3 : 1.5,
        fillColor: "#0878f9",
        fillOpacity: active ? 0.24 : 0.09
      });
      const stateLayer = shapes
        ? window.L.geoJSON(shapes.service, { style: (feature) => shapeStyle(feature.properties.key === activeKey) }).addTo(map)
        : null;
      const stateShape = (key) => stateLayer?.getLayers().find((layer) => layer.feature.properties.key === key);
      stateLayer?.eachLayer((layer) => {
        layer.on("click", () => setRegion(layer.feature.properties.key));
        layer.bindTooltip(regionNames[layer.feature.properties.key] || layer.feature.properties.name, { sticky: true });
      });
      if (shapes) {
        // If the street tiles cannot load, show the neighbouring states so the map still reads as a map.
        let contextShown = false;
        tiles.on("tileerror", () => {
          if (contextShown) return;
          contextShown = true;
          canvas.classList.add("no-tiles");
          window.L.geoJSON(shapes.context, {
            interactive: false,
            style: { color: "#9fb4c6", weight: 1, fillColor: "#f4f7fa", fillOpacity: 1 }
          }).addTo(map).bringToBack();
        });
      }
      let fitted = false;
      const settle = () => {
        map.invalidateSize(false);
        if (!fitted && stateLayer && canvas.offsetWidth) {
          fitted = true;
          map.fitBounds(stateLayer.getBounds(), { padding: [18, 18] });
        }
      };

      const showRegion = (key) => {
        const region = regions[key];
        if (!region) return;
        document.querySelectorAll("[data-map-region]").forEach((button) => button.classList.toggle("active", button.dataset.mapRegion === key));
        marker.setLatLng(region.center);
        activeKey = key;
        stateLayer?.setStyle((feature) => shapeStyle(feature.properties.key === key));
        const shape = stateShape(key);
        if (shape) map.fitBounds(shape.getBounds(), { padding: [26, 26], maxZoom: 11, animate: true, duration: 0.35 });
        else map.setView(region.center, region.zoom, { animate: true, duration: 0.35 });
      };

      document.addEventListener("chi:regionchange", (event) => showRegion(event.detail.region));
      document.querySelectorAll("[data-region]").forEach((control) => {
        control.addEventListener("click", () => showRegion(control.dataset.region));
      });
      // A searched address: drop the pin on it and zoom in.
      document.addEventListener("chi:locate", (event) => {
        const point = [event.detail.lat, event.detail.lon];
        marker.setLatLng(point);
        map.setView(point, 11, { animate: true, duration: 0.35 });
      });
      window.setTimeout(settle, 0);
      window.addEventListener("resize", settle);
      return;
    }

    // Fallback retained for browsers where the local map engine cannot initialize.
    const mapUrl = (region) => `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(region.bbox)}&layer=mapnik&marker=${encodeURIComponent(region.marker)}`;
    let activeMapUrl = mapUrl(regions.md);
    let loadTimer;
    let retryCount = 0;

    const showMapLoading = () => mapShell?.classList.remove("map-is-loaded");
    const loadMap = (url, isRetry = false) => {
      activeMapUrl = url;
      showMapLoading();
      window.clearTimeout(loadTimer);
      if (isRetry) {
        const separator = url.includes("?") ? "&" : "?";
        canvas.src = `${url}${separator}reload=${Date.now()}`;
      } else {
        canvas.src = url;
      }
      loadTimer = window.setTimeout(() => {
        if (!mapShell?.classList.contains("map-is-loaded") && retryCount < 2) {
          retryCount += 1;
          loadMap(activeMapUrl, true);
        }
      }, 2500);
    };

    canvas.addEventListener("load", () => {
      window.clearTimeout(loadTimer);
      retryCount = 0;
      window.setTimeout(() => mapShell?.classList.add("map-is-loaded"), 180);
    });
    retryButton?.addEventListener("click", () => loadMap(activeMapUrl, true));
    loadMap(activeMapUrl, true);

    const mapLayer = canvas.querySelector("[data-map-layer]");
    const zoomLabel = canvas.querySelector("[data-map-zoom-level]");
    const liveMapLink = canvas.querySelector("[data-open-live-map]");
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let pointerStart = null;

    const updateView = () => {
      if (mapLayer) mapLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      if (zoomLabel) zoomLabel.value = `${Math.round(zoom * 100)}%`;
    };

    const resetView = () => {
      zoom = 1;
      panX = 0;
      panY = 0;
      updateView();
    };

    const changeZoom = (amount) => {
      zoom = Math.min(2.4, Math.max(0.8, Number((zoom + amount).toFixed(2))));
      updateView();
    };

    const selectMapRegion = (key) => {
      const region = regions[key];
      if (!region) return;
      const targetUrl = mapUrl(region);
      document.querySelectorAll("[data-map-region]").forEach((button) => button.classList.toggle("active", button.dataset.mapRegion === key));
      canvas.querySelectorAll("[data-map-region-shape]").forEach((shape) => shape.classList.toggle("is-active", shape.dataset.mapRegionShape === key));
      if (activeMapUrl !== targetUrl || !canvas.src.includes(encodeURIComponent(region.bbox))) {
        retryCount = 0;
        loadMap(targetUrl, true);
      }
      if (liveMapLink) liveMapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(region.name)}`;
    };

    document.addEventListener("chi:regionchange", (event) => {
      selectMapRegion(event.detail.region);
    });

    // Run the map navigation from each service-area control as well. This keeps
    // the real map responsive even if another page interaction interrupts the shared event.
    document.querySelectorAll("[data-region]").forEach((control) => {
      control.addEventListener("click", () => selectMapRegion(control.dataset.region));
    });

    canvas.querySelectorAll("[data-map-region-shape]").forEach((shape) => {
      const selectShape = () => setRegion(shape.dataset.mapRegionShape);
      shape.addEventListener("click", selectShape);
      shape.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        selectShape();
      });
    });

    canvas.querySelectorAll("[data-map-zoom]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.mapZoom;
        if (action === "in") changeZoom(0.2);
        if (action === "out") changeZoom(-0.2);
        if (action === "reset") resetView();
      });
    });

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      changeZoom(event.deltaY < 0 ? 0.12 : -0.12);
    }, { passive: false });
    canvas.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, a, [data-map-region-shape]")) return;
      pointerStart = { x: event.clientX, y: event.clientY, panX, panY };
      canvas.setPointerCapture?.(event.pointerId);
      canvas.classList.add("is-panning");
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!pointerStart) return;
      panX = pointerStart.panX + event.clientX - pointerStart.x;
      panY = pointerStart.panY + event.clientY - pointerStart.y;
      updateView();
    });
    const stopPanning = () => {
      pointerStart = null;
      canvas.classList.remove("is-panning");
    };
    canvas.addEventListener("pointerup", stopPanning);
    canvas.addEventListener("pointercancel", stopPanning);
    canvas.addEventListener("keydown", (event) => {
      const keys = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
      if (keys[event.key]) {
        event.preventDefault();
        [panX, panY] = [panX + keys[event.key][0], panY + keys[event.key][1]];
        updateView();
      }
      if (["+", "="].includes(event.key)) { event.preventDefault(); changeZoom(0.2); }
      if (event.key === "-") { event.preventDefault(); changeZoom(-0.2); }
    });
    updateView();

  };

  const saveBookingToInbox = (form) => {
    const cfg = window.CHI_CMS_CONFIG || {};
    if (!cfg.url || !cfg.anonKey || /YOUR_/.test(cfg.url + cfg.anonKey)) return Promise.resolve();
    const data = new FormData(form);
    if (data.get("bot-field")) return Promise.resolve();
    const val = (k) => String(data.get(k) || "").trim().slice(0, 2000);
    const row = {
      first_name: val("firstName"),
      last_name: val("lastName"),
      email: val("email"),
      phone: val("phone"),
      address: val("address"),
      city: val("city"),
      state: val("state"),
      zip: val("zip"),
      property_type: val("propertyType"),
      square_feet: val("squareFeet"),
      services: data.getAll("services").map(String).slice(0, 10),
      preferred_date: val("preferredDate"),
      preferred_time: val("preferredTime"),
      message: val("message")
    };
    const controller = "AbortController" in window ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), 4000);
    return fetch(cfg.url.replace(/\/$/, "") + "/rest/v1/bookings", {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(row),
      signal: controller?.signal,
      keepalive: true
    }).catch(() => {}).finally(() => clearTimeout(timer));
  };

  const initBookingForm = () => {
    const form = document.querySelector("[data-booking-form]");
    if (!form) return;

    const success = document.querySelector("[data-form-success]");
    const servicesSummary = document.querySelector("[data-summary-services]");
    const dateSummary = document.querySelector("[data-summary-date]");
    const dateInput = form.querySelector("[data-date-input]");
    const editButton = document.querySelector("[data-edit-request]");
    const successSummary = document.querySelector("[data-success-summary]");
    const submitButton = form.querySelector("[type='submit']");

    if (dateInput) {
      const today = new Date();
      const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
      dateInput.min = localToday;
      dateInput.addEventListener("change", () => {
        dateSummary.textContent = dateInput.value ? new Date(`${dateInput.value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not selected";
      });
    }

    const query = new URLSearchParams(window.location.search);
    ["firstName", "email", "phone", "address", "preferredDate", "preferredTime"].forEach((name) => {
      const value = query.get(name);
      const field = form.elements.namedItem(name);
      if (!value || !(field instanceof HTMLElement)) return;
      field.value = value;
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const updateServices = () => {
      const selected = [...form.querySelectorAll("input[name='services']:checked")].map((input) => input.value);
      servicesSummary.textContent = selected.length ? selected.join(", ") : "None selected";
      form.querySelectorAll(".service-check").forEach((label) => {
        const checkbox = label.querySelector("input");
        label.classList.toggle("checked", checkbox.checked);
      });
    };

    form.querySelectorAll("input[name='services']").forEach((input) => input.addEventListener("change", updateServices));
    updateServices();

    const clearErrors = () => form.querySelectorAll(".field-error").forEach((field) => field.classList.remove("field-error"));

    const querySubmitted = new URLSearchParams(window.location.search).get("submitted") === "true";
    if (querySubmitted && success) {
      form.hidden = true;
      success.hidden = false;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      clearErrors();

      const required = [...form.querySelectorAll("[required]")];
      const invalid = required.filter((field) => !field.checkValidity());
      if (invalid.length) {
        invalid.forEach((field) => field.classList.add("field-error"));
        invalid[0].focus();
        return;
      }

      submitButton.disabled = true;
      // Copy the request into the admin portal's inbox, then submit to
      // Netlify Forms as before. The inbox is best-effort: if it is slow or
      // not set up, the visitor's request still goes through.
      saveBookingToInbox(form).finally(() => form.submit());
    });

    editButton?.addEventListener("click", () => {
      success.hidden = true;
      form.hidden = false;
      submitButton.disabled = false;
      form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  };

  const initFaq = () => {
    const details = [...document.querySelectorAll(".faq-list details")];
    details.forEach((item) => {
      if (item.dataset.faqBound) return;
      item.dataset.faqBound = "1";
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        details.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  };

  const initWebMcp = () => {
    const form = document.querySelector("[data-booking-form]");
    const context = document.modelContext;
    if (!form || !context?.registerTool) return;

    const lifecycle = new AbortController();
    const allowedServices = ["Home inspection", "Radon testing", "Mold & moisture testing", "Water quality testing", "Termite inspection", "Thermal imaging"];

    const setField = (name, value) => {
      if (value === undefined || value === null || value === "") return;
      const field = form.elements.namedItem(name);
      if (!(field instanceof HTMLElement)) return;
      field.value = String(value);
      field.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const register = context.registerTool({
      name: "stage_inspection_request",
      title: "Stage inspection request",
      description: "Prefill the visible CHI inspection request form for the visitor to review. This stages the request but does not send or confirm an appointment.",
      inputSchema: {
        type: "object",
        properties: {
          firstName: { type: "string", minLength: 1 },
          lastName: { type: "string", minLength: 1 },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string", minLength: 1 },
          city: { type: "string", minLength: 1 },
          state: { type: "string", enum: ["md", "pa", "dc", "wv"] },
          zip: { type: "string" },
          propertyType: { type: "string" },
          squareFeet: { type: ["string", "number"] },
          services: { type: "array", items: { type: "string", enum: allowedServices }, uniqueItems: true },
          preferredDate: { type: "string" },
          preferredTime: { type: "string" },
          message: { type: "string" }
        },
        required: ["address", "city", "state"],
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object" || !regionNames[input.state]) {
          throw new Error("A valid address, city and service state are required.");
        }

        ["firstName", "lastName", "email", "phone", "address", "city", "zip", "propertyType", "squareFeet", "preferredDate", "preferredTime", "message"].forEach((name) => setField(name, input[name]));
        setRegion(input.state);

        if (Array.isArray(input.services)) {
          const selected = input.services.filter((service) => allowedServices.includes(service));
          form.querySelectorAll("input[name='services']").forEach((checkbox) => {
            checkbox.checked = selected.includes(checkbox.value);
            checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          });
        }

        form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        return {
          status: "staged",
          submitted: false,
          state: regionNames[input.state],
          services: Array.isArray(input.services) ? input.services : ["Home inspection"]
        };
      }
    }, { signal: lifecycle.signal });

    Promise.resolve(register).catch(() => {});
  };

  setYears();

  /* ---------- v2: speed, motion and usability ---------- */

  // Load the map engine only when the service-area map is about to scroll into view.
  const initLazyServiceMap = () => {
    const canvas = document.querySelector("#service-area-map");
    if (!canvas) return;
    if (window.L || canvas.dataset.leafletMap === undefined) { initLiveServiceMap(); return; }
    const base = (document.querySelector('script[src$="app.js"]')?.getAttribute("src") || "assets/app.js").replace(/app\.js$/, "");
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${base}vendor/leaflet/leaflet.css`;
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = `${base}vendor/leaflet/leaflet.js`;
      js.onload = () => initLiveServiceMap();
      js.onerror = () => initLiveServiceMap();
      // State outlines first, then the map engine that draws them.
      const geo = document.createElement("script");
      geo.src = `${base}service-area-geo.js`;
      geo.onload = geo.onerror = () => document.head.appendChild(js);
      document.head.appendChild(geo);
    };
    if (!("IntersectionObserver" in window)) { start(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: "900px 0px" });
    io.observe(canvas);
    document.querySelectorAll('a[href="#service-area"]').forEach((a) => a.addEventListener("click", start, { once: true }));
  };

  // Fast, capped in-page scrolling (long smooth scrolls felt sluggish).
  const initAnchorScroll = () => {
    const header = document.querySelector("[data-header]");
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || link.hasAttribute("data-open-booking") || event.defaultPrevented) return;
      const id = link.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      const offset = (header?.offsetHeight || 80) + 12;
      const to = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      history.replaceState(null, "", id);
      if (reduceMotion) { window.scrollTo(0, to); return; }
      const from = window.scrollY;
      const duration = Math.min(650, 260 + Math.abs(to - from) * 0.08);
      const t0 = performance.now();
      let cancelled = false;
      const cancel = () => { cancelled = true; };
      window.addEventListener("wheel", cancel, { once: true, passive: true });
      window.addEventListener("touchstart", cancel, { once: true, passive: true });
      document.documentElement.style.scrollBehavior = "auto";
      const step = (now) => {
        if (cancelled) { document.documentElement.style.scrollBehavior = ""; return; }
        const t = Math.min(1, (now - t0) / duration);
        window.scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) requestAnimationFrame(step);
        else document.documentElement.style.scrollBehavior = "";
      };
      requestAnimationFrame(step);
    });
  };

  // Highlight the nav item for the section currently on screen.
  const initScrollSpy = () => {
    const links = [...document.querySelectorAll('#primary-nav a[href^="#"]')];
    const map = new Map();
    links.forEach((a) => {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec && !a.hasAttribute("data-open-booking")) map.set(sec, a);
    });
    if (!map.size || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const link = map.get(e.target);
        links.forEach((l) => l.classList.toggle("active", l === link));
        link.dispatchEvent(new Event("pointerenter"));
        link.closest(".limelight-nav")?.dispatchEvent(new Event("pointerleave"));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    map.forEach((_, sec) => io.observe(sec));
  };

  // Staggered entrance for cards and list items, added without touching the markup.
  const initStagger = () => {
    const groups = [
      ".trust-strip .container > div",
      ".service-list > *",
      ".inspection-gallery > *",
      ".defect-grid > *",
      ".defect-thumbs > *",
      ".defect-list > *",
      ".contact-cards > *",
      ".about-facts > *",
      ".feature-stack > *",
      ".process-track > *",
      ".reviews-grid > *",
      ".faq-list > *",
      ".footer-top > *"
    ];
    const items = [];
    groups.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (el.classList.contains("reveal")) return;
        el.style.setProperty("--rise-delay", `${Math.min(i, 6) * 80}ms`);
        // Children of an existing reveal block animate when their parent is revealed.
        if (el.parentElement.closest(".reveal")) { el.classList.add("rise-child"); return; }
        el.classList.add("rise");
        items.push(el);
      });
    });
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    document.documentElement.classList.add("motion-ready");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px" });
    items.forEach((el) => io.observe(el));
    // Anything already on screen at load shows immediately.
    requestAnimationFrame(() => items.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
    }));
  };

  // Count up the headline numbers (24h, 07, 25+) when they appear.
  const initCountUp = () => {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const nodes = [...document.querySelectorAll(".trust-icon b, .experience-display strong, .about-facts strong")]
      .filter((n) => /^\d+/.test(n.textContent.trim()));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        const text = el.textContent.trim();
        const m = text.match(/^(\d+)(.*)$/);
        const end = Number(m[1]); const pad = m[1].length; const suffix = m[2];
        const t0 = performance.now(); const dur = 1100;
        const tick = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          const v = Math.round(end * (1 - Math.pow(1 - t, 3)));
          el.textContent = String(v).padStart(pad, "0") + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    nodes.forEach((n) => io.observe(n));
  };

  // Small "back to top" button once the visitor is well down the page.
  const initBackToTop = () => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "back-to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);
    let ticking = false;
    const update = () => { btn.classList.toggle("show", window.scrollY > 1400); ticking = false; };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  };

  // Close the mobile menu with Escape.
  const initMenuKeys = () => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
        document.body.classList.remove("menu-open");
        document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
      }
    });
  };

  // Pause decorative hero motion while the hero is off screen.
  // Fetch the other hero photos only after the page has finished loading.
  const initDeferredHeroSlides = () => {
    const pending = [...document.querySelectorAll("[data-hero-slide][data-src]")];
    if (!pending.length) return;
    const load = () => pending.forEach((img) => {
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
      img.removeAttribute("data-srcset");
    });
    const later = () => ("requestIdleCallback" in window ? requestIdleCallback(load, { timeout: 2500 }) : setTimeout(load, 1200));
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
  };

  const initHeroVisibility = () => {
    const hero = document.querySelector(".inspection-hero");
    if (!hero || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(([e]) => hero.classList.toggle("is-offscreen", !e.isIntersecting)).observe(hero);
  };

  // Defect photo gallery: open the full-size photo in a viewer instead of leaving the page.
  const initDefectGallery = () => {
    const box = document.querySelector("[data-defect-lightbox]");
    const all = [...document.querySelectorAll("[data-defect-photo]")];
    if (!box || !all.length || typeof box.showModal !== "function") return;
    // Only step through photos that the current filter is showing.
    let cards = all;
    const img = box.querySelector("[data-defect-full]");
    const cap = box.querySelector("[data-defect-caption]");
    let index = 0;
    const show = (i) => {
      index = (i + cards.length) % cards.length;
      const card = cards[index];
      img.src = card.getAttribute("href");
      img.alt = card.querySelector("img")?.alt || "";
      cap.textContent = card.dataset.caption || "";
    };
    all.forEach((card) => card.addEventListener("click", (e) => {
      e.preventDefault();
      cards = all.filter((c) => !c.closest("[hidden]"));
      show(cards.indexOf(card));
      box.showModal();
    }));
    box.querySelector("[data-defect-close]").addEventListener("click", () => box.close());
    box.querySelector("[data-defect-prev]").addEventListener("click", () => show(index - 1));
    box.querySelector("[data-defect-next]").addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (e) => { if (e.target === box || e.target.tagName === "FIGURE") box.close(); });
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
    box.addEventListener("close", () => cards[index]?.focus());
  };

  // Defects page: filter the examples by building system.
  const initDefectFilter = () => {
    const bar = document.querySelector("[data-defect-filters]");
    const items = [...document.querySelectorAll("[data-defect-cat]")];
    if (!bar || !items.length) return;
    const buttons = [...bar.querySelectorAll("[data-defect-filter]")];
    buttons.forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.defectFilter;
      buttons.forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      items.forEach((item) => { item.hidden = key !== "all" && item.dataset.defectCat !== key; });
      document.querySelector("[data-defect-rail]")?.scrollTo({ left: 0 });
    }));
  };

  // Homepage defect slider: arrow buttons step one card at a time.
  const initDefectRail = () => {
    const rail = document.querySelector("[data-defect-rail]");
    const arrows = [...document.querySelectorAll("[data-defect-scroll]")];
    if (!rail || !arrows.length) return;
    const step = () => {
      const card = rail.querySelector(".defect-hcard:not([hidden])");
      return card ? card.getBoundingClientRect().width + 20 : rail.clientWidth * 0.8;
    };
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      arrows.forEach((arrow) => {
        arrow.disabled = Number(arrow.dataset.defectScroll) < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft >= max;
      });
    };
    arrows.forEach((arrow) => arrow.addEventListener("click", () => {
      rail.scrollBy({ left: step() * Number(arrow.dataset.defectScroll), behavior: reduceMotion ? "auto" : "smooth" });
    }));
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    document.querySelectorAll("[data-defect-filter]").forEach((b) => b.addEventListener("click", () => requestAnimationFrame(update)));
    update();
  };

  // Service-area search: a visitor types a ZIP code, city or address and learns
  // whether CHI inspects there. ZIP codes are answered instantly from their
  // prefix; anything else is looked up with OpenStreetMap's geocoder.
  const initAreaSearch = () => {
    const form = document.querySelector("[data-area-search]");
    const out = document.querySelector("[data-area-result]");
    if (!form || !out) return;
    const input = form.querySelector("input");
    const button = form.querySelector("button");
    const scheduler = document.querySelector(".area-copy .button-primary")?.getAttribute("href") || "#contact";
    const typed = { maryland: "md", md: "md", pennsylvania: "pa", pa: "pa", "west virginia": "wv", wv: "wv",
      "district of columbia": "dc", "washington dc": "dc", "washington, dc": "dc", dc: "dc" };
    const iso = { "US-MD": "md", "US-PA": "pa", "US-WV": "wv", "US-DC": "dc" };
    const zipRegion = (zip) => {
      const p = Number(zip.slice(0, 3));
      if (p === 200 || (p >= 202 && p <= 205)) return "dc";
      if ((p >= 206 && p <= 212) || (p >= 214 && p <= 219)) return "md";
      if (p >= 150 && p <= 196) return "pa";
      if (p >= 247 && p <= 268) return "wv";
      return null;
    };
    const el = (tag, text, href) => {
      const node = document.createElement(tag);
      node.textContent = text;
      if (href) node.href = href;
      return node;
    };
    const render = (kind, title, parts) => {
      out.hidden = false;
      out.className = `area-search-result${kind ? ` is-${kind}` : ""}`;
      out.replaceChildren(el("strong", title));
      if (parts) { const line = el("span", ""); line.append(...parts); out.append(line); }
    };
    const yes = (key, place) => {
      setRegion(key);
      const link = el("a", "Book your inspection", scheduler);
      if (/^https?:/.test(scheduler)) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
      render("yes", `Yes, we inspect in ${place || regionNames[key]}.`, [link, " or call ", el("a", "301-788-6608", "tel:+13017886608"), "."]);
    };
    const no = (place) => render("no", `${place || "That location"} is outside our usual service area.`,
      ["We cover Maryland, Pennsylvania, Washington, DC and West Virginia. Call ", el("a", "301-788-6608", "tel:+13017886608"), " to ask about your property."]);
    const geocode = (query) => {
      const controller = "AbortController" in window ? new AbortController() : null;
      const timer = setTimeout(() => controller?.abort(), 7000);
      return fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" }, signal: controller?.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("lookup failed"))))
        .then((rows) => rows && rows[0] ? rows[0] : null)
        .finally(() => clearTimeout(timer));
    };
    const label = (hit) => {
      const a = hit.address || {};
      return [a.city || a.town || a.village || a.hamlet || a.county, a.state].filter(Boolean).join(", ");
    };
    const pin = (hit) => {
      const lat = Number(hit.lat); const lon = Number(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) document.dispatchEvent(new CustomEvent("chi:locate", { detail: { lat, lon, query: input.value.trim() } }));
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = input.value.trim();
      if (!query) { input.focus(); return; }
      const zip = query.match(/^(\d{5})(-\d{4})?$/);
      const named = typed[query.toLowerCase().replace(/\./g, "")];
      if (named) { yes(named); return; }
      if (zip) {
        const key = zipRegion(zip[1]);
        if (key) yes(key, `${zip[1]} (${regionNames[key]})`); else no(`ZIP code ${zip[1]}`);
        if (key && document.querySelector("[data-google-map-frame]")) { document.dispatchEvent(new CustomEvent("chi:locate", { detail: { query: `${zip[1]}, USA` } })); return; }
        // Best effort: put the pin on the ZIP code itself.
        if (key) geocode(zip[1]).then((hit) => { if (hit && iso[(hit.address || {})["ISO3166-2-lvl4"]] === key) pin(hit); }).catch(() => {});
        return;
      }
      button.disabled = true;
      render("", "Checking that location…");
      geocode(query).then((hit) => {
        if (!hit) { render("no", "We couldn't find that place.", ["Try a ZIP code, or a city and state."]); return; }
        const key = iso[(hit.address || {})["ISO3166-2-lvl4"]];
        if (key) { yes(key, label(hit)); pin(hit); } else no(label(hit));
      }).catch(() => {
        render("no", "The address search isn't available right now.", ["Enter your ZIP code instead, or call ", el("a", "301-788-6608", "tel:+13017886608"), "."]);
      }).finally(() => { button.disabled = false; });
    });
  };

  // Service area: real Google map that follows the chosen region or searched address.
  const initGoogleServiceMap = () => {
    const frame = document.querySelector("[data-google-map-frame]");
    if (!frame) return;
    const views = { md: ["Maryland", 7], pa: ["Pennsylvania", 7], dc: ["Washington, DC", 11], wv: ["West Virginia", 7] };
    const go = (query, zoom, label) => {
      frame.src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
      frame.title = `Map of ${label || query}`;
      const link = document.querySelector("[data-google-map-link]");
      if (link) link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    };
    const showRegion = (key) => {
      const v = views[key];
      if (!v) return;
      document.querySelectorAll("[data-map-region]").forEach((b) => b.classList.toggle("active", b.dataset.mapRegion === key));
      if (!frame.src.includes(encodeURIComponent(v[0]))) go(v[0], v[1], `CHI's ${v[0]} service area`);
    };
    document.addEventListener("chi:regionchange", (e) => showRegion(e.detail.region));
    document.addEventListener("chi:locate", (e) => {
      if (e.detail.query) go(e.detail.query, 13);
      else if (e.detail.lat != null) go(`${e.detail.lat},${e.detail.lon}`, 13);
    });
  };

  // Inside a sandboxed preview (e.g. Claude's artifact viewer) Google's iframe is blocked,
  // so draw the service states with the bundled Leaflet + outlines instead. Live site keeps Google.
  const initPreviewMaps = () => {
    let framed = false;
    try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (!framed) return;
    document.querySelectorAll("[data-gmap]").forEach((host) => {
      host.querySelector("iframe")?.remove();
      host.classList.add("gmap-preview");
      const note = document.createElement("div");
      note.className = "gmap-preview-note";
      note.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg><strong>Google Map</strong><span>The live Google Map shows here on the published website. This preview can\u2019t load maps.</span>';
      host.prepend(note);
    });
  };

  // Hero service tags jump to that service.
  const initServiceJump = () => {
    document.querySelectorAll("[data-service-jump]").forEach((a) => a.addEventListener("click", () => {
      document.querySelector(`.service-row[data-service="${a.dataset.serviceJump}"]`)?.click();
    }));
  };

  // Service Area hero search: hands the query to the coverage checker below.
  const initHeroAreaSearch = () => {
    const form = document.querySelector("[data-hero-area-search]");
    const target = document.querySelector("[data-area-search]");
    if (!form || !target) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = form.querySelector("input").value.trim();
      const input = target.querySelector("input");
      input.value = q;
      target.requestSubmit ? target.requestSubmit() : target.dispatchEvent(new Event("submit", { cancelable: true }));
      const header = document.querySelector("[data-header]");
      const top = target.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 80) - 24;
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    });
  };

  // Contact page form: posts to Vercel /api/contact, which emails ken@chinspects.com.
  const initConnectForm = () => {
    const form = document.querySelector("[data-connect-form]");
    if (!form) return;
    const err = form.querySelector("[data-connect-error]");
    const ok = form.querySelector("[data-connect-success]");
    const button = form.querySelector("[type='submit']");
    const idleLabel = button.textContent.trim() || "Submit";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      err.hidden = true;
      ok.hidden = true;
      const bad = [...form.querySelectorAll("[required]")].find((f) => !f.value.trim() || !f.checkValidity());
      if (bad) {
        err.textContent = bad.type === "email" && bad.value.trim() ? "Enter a valid email address." : `Please fill in ${bad.placeholder.replace(" *", "")}.`;
        err.hidden = false;
        bad.focus();
        return;
      }
      const data = new FormData(form);
      if (String(data.get("bot-field") || "").trim()) {
        form.reset();
        ok.hidden = false;
        return;
      }
      const phone = String(data.get("phone") || "").trim();
      const visitorEmail = String(data.get("email") || "").trim();

      const payload = {
        firstName: String(data.get("firstName") || "").trim(),
        lastName: String(data.get("lastName") || "").trim(),
        email: visitorEmail,
        zip: String(data.get("zip") || "").trim(),
        phone: phone ? `${data.get("countryCode")} ${phone}` : "",
        capital: String(data.get("capital") || "").trim(),
        botField: String(data.get("bot-field") || "").trim()
      };

      button.disabled = true;
      button.textContent = "Sending...";

      const withTimeout = (ms) => {
        const controller = "AbortController" in window ? new AbortController() : null;
        const timer = setTimeout(() => controller?.abort(), ms);
        return { signal: controller?.signal, done: () => clearTimeout(timer) };
      };

      const sendViaVercel = () => {
        const t = withTimeout(20000);
        return fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          signal: t.signal
        }).then(async (res) => {
          let body = null;
          try { body = await res.json(); } catch { body = null; }
          if (!res.ok || (body && body.ok === false)) throw new Error("api");
        }).finally(t.done);
      };

      const sendViaFormsubmit = () => {
        const t = withTimeout(20000);
        return fetch("https://formsubmit.co/ajax/" + encodeURIComponent("ken@chinspects.com"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: "New message from the CHI contact form",
            _template: "table",
            _captcha: "false",
            _replyto: visitorEmail,
            "First name": payload.firstName,
            "Last name": payload.lastName,
            Email: visitorEmail,
            "Zip code": payload.zip,
            Phone: payload.phone,
            "Capital for investment": payload.capital
          }),
          signal: t.signal
        }).then(async (res) => {
          if (!res.ok) throw new Error("email");
          const type = (res.headers.get("content-type") || "").toLowerCase();
          if (!type.includes("json")) return;
          const body = await res.json();
          if (body && String(body.success) === "false") throw new Error("email");
        }).finally(t.done);
      };

      sendViaVercel().catch(() => sendViaFormsubmit()).then(() => {
        form.reset();
        ok.hidden = false;
        button.textContent = "Sent";
        setTimeout(() => { button.textContent = idleLabel; }, 2200);
      }).catch(() => {
        err.textContent = "We could not send that just now. Please call 301-788-6608.";
        err.hidden = false;
        button.textContent = idleLabel;
      }).finally(() => {
        button.disabled = false;
        if (button.textContent === "Sending...") button.textContent = idleLabel;
      });
    });
  };

  // Services page photo slider: arrows move one card at a time.
  const initStripRail = () => {
    const rail = document.querySelector("[data-strip-rail]");
    const arrows = [...document.querySelectorAll("[data-strip-scroll]")];
    if (!rail || !arrows.length) return;
    const step = () => (rail.firstElementChild?.getBoundingClientRect().width || 300) + 20;
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth - 2;
      arrows.forEach((a) => { a.disabled = Number(a.dataset.stripScroll) < 0 ? rail.scrollLeft <= 2 : rail.scrollLeft >= max; });
    };
    arrows.forEach((a) => a.addEventListener("click", () => {
      rail.scrollBy({ left: step() * Number(a.dataset.stripScroll), behavior: reduceMotion ? "auto" : "smooth" });
    }));
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  };

  // "See what we found" opens the photo viewer on this page.
  const initDefectOpenAll = () => {
    document.querySelectorAll("[data-defect-open-all]").forEach((btn) => btn.addEventListener("click", () => {
      document.querySelector("[data-defect-photo]")?.click();
    }));
  };

  document.documentElement.classList.add("js");

  initHeader();
  initLimelightNav();
  initReveal();
  initHero();
  initInteractiveServices();
  initRegionMaps();
  initLazyServiceMap();
  initAnchorScroll();
  initScrollSpy();
  initStagger();
  initCountUp();
  initBackToTop();
  initMenuKeys();
  initHeroVisibility();
  initDeferredHeroSlides();
  initBookingForm();
  initFaq();
  initDefectGallery();
  initDefectFilter();
  initDefectRail();
  initAreaSearch();
  initGoogleServiceMap();
  initPreviewMaps();
  initHeroAreaSearch();
  initServiceJump();
  initConnectForm();
  initDefectOpenAll();
  initStripRail();
  initWebMcp();

  applyCmsContent(window.CHI_CONTENT);
  window.CHI = window.CHI || {};
  window.CHI.refreshContent = applyCmsContent;
  window.CHI.rebindFaq = initFaq;
  window.CHI.observeReveal = observeReveal;
})();
