// GrainBroker shared behaviour
(function () {
  // Mobile nav
  var btn = document.querySelector(".menu-btn");
  var links = document.querySelector(".nav-links");
  if (btn && links) {
    btn.addEventListener("click", function () {
      links.classList.toggle("open");
      btn.setAttribute("aria-expanded", links.classList.contains("open"));
    });
  }

  window.GB_CONFIG = {
    // Brevo form endpoints. Grower registrations land in list "Grain Broker - Growers".
    growerFormEndpoint: "", // was Brevo sibforms; sell → GHL via buyerIntakeUrl
    // Buyer intake (buy.html) posts to Grain Broker GHL form "Buyer Needs"
    // (ydhWyeSBO8IfFxYPCQRS). Public submit requires Cloudflare Turnstile token.
    buyerFormEndpoint: "https://backend.leadconnectorhq.com/forms/submit",
    buyerGhlFormId: "ydhWyeSBO8IfFxYPCQRS",
    buyerGhlLocationId: "DJQBTIQasTdt54iPJuny",
    // GHL's invisible Turnstile site key (from LeadConnector form widget).
    buyerTurnstileSiteKey: "0x4AAAAAACCpVlau-4k7cJ33",
    // Inbound webhook backup (no Turnstile). Set when workflow is live.
    buyerIntakeUrl: "https://gentle-integrating-commitment-riverside.trycloudflare.com", // Cloudflare Worker: upsert+tag (set after deploy)
    buyerWebhookUrl: "", // abandoned — GHL stays in test-capture mode
    buyerCheckFormEndpoint: "https://4e07af79.sibforms.com/serve/MUIFAF4JSYeF1sh00OXN8UCwc5-V_9Gl-KVslk6Bmds0o6XTDv8CU5p_zwNTYeUxoSco4CtYM5mCoXR5SSCDCCZ4NGhZpNCQ8ZTjmRTGpT3YMgv94WgN4CDnsUq7dWKkKoHMf0-ShJ6tlaOs9XuyWuG5BRJu4gqSdT_5rFeewo0pLa_CUeOmK2UGS2kSKMB8_HhJyriaWa0Kk_yWnQ==",
    fallbackEmail: "info@grainbroker.com.au",
    phoneDisplay: "0414 503 466"
  };

  function auPhone(raw) {
    var d = (raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.slice(0, 2) === "61") return d;
    if (d.charAt(0) === "0") return "61" + d.slice(1);
    if (d.length === 9) return "61" + d;
    return "";
  }

  function localTimezoneLabel() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Sydney";
      var offsetMin = -new Date().getTimezoneOffset();
      var sign = offsetMin >= 0 ? "+" : "-";
      var abs = Math.abs(offsetMin);
      var hh = String(Math.floor(abs / 60)).padStart(2, "0");
      var mm = String(abs % 60).padStart(2, "0");
      return tz + " (GMT" + sign + hh + ":" + mm + ")";
    } catch (e) {
      return "Australia/Sydney (GMT+10:00)";
    }
  }

  function buildBuyerNeedsText(payload) {
    var parts = [];
    if (payload.COMMODITY) parts.push("Commodity: " + payload.COMMODITY);
    if (payload.GRADE) parts.push("Grade: " + payload.GRADE);
    if (payload.TONNES) parts.push("Tonnes: " + payload.TONNES);
    if (payload.DELIVERY) parts.push("Delivery: " + payload.DELIVERY);
    if (payload.WINDOW) parts.push("Window: " + payload.WINDOW);
    if (payload.NOTES) parts.push("Notes: " + payload.NOTES);
    if (payload.TYPE) parts.push("(" + payload.TYPE + ")");
    return parts.join("\n");
  }

  function loadTurnstileApi(done) {
    if (window.turnstile && typeof window.turnstile.render === "function") {
      done(null);
      return;
    }
    var existing = document.querySelector("script[data-gb-turnstile]");
    if (existing) {
      existing.addEventListener("load", function () { done(null); });
      existing.addEventListener("error", function () { done(new Error("turnstile-script")); });
      return;
    }
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.dataset.gbTurnstile = "1";
    s.onload = function () { done(null); };
    s.onerror = function () { done(new Error("turnstile-script")); };
    document.head.appendChild(s);
  }

  // Obtain an invisible Turnstile token (required by GHL public forms/submit).
  function getTurnstileToken(siteKey, done) {
    if (!siteKey) {
      done(new Error("missing-sitekey"), null, 0);
      return;
    }
    var started = Date.now();
    loadTurnstileApi(function (err) {
      if (err) {
        done(err, null, Date.now() - started);
        return;
      }
      try {
        var host = document.getElementById("gb-turnstile-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "gb-turnstile-host";
          host.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;";
          document.body.appendChild(host);
        }
        host.innerHTML = "";
        var finished = false;
        var widgetId = window.turnstile.render(host, {
          sitekey: siteKey,
          size: "invisible",
          callback: function (token) {
            if (finished) return;
            finished = true;
            done(null, token, Date.now() - started);
          },
          "error-callback": function () {
            if (finished) return;
            finished = true;
            done(new Error("turnstile-error"), null, Date.now() - started);
          },
          "expired-callback": function () {
            if (finished) return;
            finished = true;
            done(new Error("turnstile-expired"), null, Date.now() - started);
          }
        });
        // Invisible widgets usually auto-run; execute is safe if supported.
        try {
          if (typeof window.turnstile.execute === "function") {
            window.turnstile.execute(widgetId);
          }
        } catch (e2) {}
        setTimeout(function () {
          if (finished) return;
          finished = true;
          done(new Error("turnstile-timeout"), null, Date.now() - started);
        }, 15000);
      } catch (e) {
        done(e, null, Date.now() - started);
      }
    });
  }

  function postBuyerToGhl(summary, payload, token, waitedMs, onDone) {
    var cfg = window.GB_CONFIG;
    var fields = {
      full_name: payload.CONTACT || "",
      phone: payload.PHONE || "",
      email: payload.EMAIL || "",
      organization: payload.COMPANY || "",
      TqNpd1TFkhE487lGHVBV: buildBuyerNeedsText(payload) || String(summary || ""),
      wo9aHn3xzJsYVwFykxy1: "",
      Timezone: localTimezoneLabel()
    };

    var body = new FormData();
    body.append("formData", JSON.stringify(fields));
    body.append("locationId", cfg.buyerGhlLocationId);
    body.append("formId", cfg.buyerGhlFormId);
    if (token) body.append("turnstileNonInteractiveToken", token);

    var headers = {};
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) headers.timezone = tz;
    } catch (e) {}
    if (typeof waitedMs === "number") {
      headers["x-turnstile-submit-delay-ms"] = String(waitedMs);
      headers["x-turnstile-non-interactive-wait-ms"] = String(waitedMs);
    }

    var url = cfg.buyerFormEndpoint
      + "?formId=" + encodeURIComponent(cfg.buyerGhlFormId)
      + "&locationId=" + encodeURIComponent(cfg.buyerGhlLocationId);

    fetch(url, { method: "POST", body: body, headers: headers })
      .then(function (resp) {
        return resp.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) {}
          if (!resp.ok) {
            var msg = (data && (data.message || data.error || data.statusMessage)) || ("HTTP " + resp.status);
            var codes = data && data.errorCodes ? " [" + data.errorCodes.join(",") + "]" : "";
            onDone(false, msg + codes);
            return;
          }
          // Accept typical GHL success shapes; also bare 200.
          var ok = !data || data.status === true || data.success === true || data.id || data.contactId || data.status === "ok";
          // Some responses use { status: false, message }
          if (data && data.status === false) ok = false;
          onDone(!!ok, ok ? null : ((data && data.message) || "Submit rejected"));
        });
      })
      .catch(function (err) {
        onDone(false, (err && err.message) || "Network error");
      });
  }

  // Prefer Cloudflare Worker intake (upsert + buyer-needs). Broken GHL inbound webhook disabled.
  // Do not use forms/submit from this domain — Turnstile site key is hostname-bound to GHL.
  window.gbSubmit = function (summary, payload, onDone) {
    var cfg = window.GB_CONFIG;
    payload = payload || {};
    function fail(msg) {
      try { console.error("[GrainBroker buy submit]", msg); } catch (e) {}
      onDone(false, msg || "Submit failed");
    }
    function ok() { onDone(true, null); }

    if (cfg.buyerIntakeUrl) {
      var body = {
        type: "buyer",
        EMAIL: payload.EMAIL || "",
        PHONE: payload.PHONE || "",
        CONTACT: payload.CONTACT || "",
        COMPANY: payload.COMPANY || "",
        COMMODITY: payload.COMMODITY || "",
        GRADE: payload.GRADE || "",
        TONNES: payload.TONNES || "",
        DELIVERY: payload.DELIVERY || "",
        WINDOW: payload.WINDOW || "",
        NOTES: payload.NOTES || "",
        TYPE: payload.TYPE || "",
        needs: buildBuyerNeedsText(payload) || String(summary || ""),
        source: "grainbroker.com.au/buy.html"
      };
      var headers = { "Content-Type": "application/json", "Accept": "application/json" };
      if (cfg.buyerIntakeSecret) headers["X-GrainBroker-Intake"] = cfg.buyerIntakeSecret;
      fetch(cfg.buyerIntakeUrl, { method: "POST", headers: headers, body: JSON.stringify(body) })
        .then(function (resp) {
          return resp.text().then(function (text) {
            var data = null;
            try { data = text ? JSON.parse(text) : null; } catch (e) {}
            if (!resp.ok || !(data && data.ok)) {
              fail((data && data.error) || ("Intake HTTP " + resp.status));
              return;
            }
            ok();
          });
        })
        .catch(function (err) { fail((err && err.message) || "Intake network error"); });
      return;
    }

    fail("Buyer intake not configured — call 0414 503 466");
  };

  window.gbSubmitGrower = function (fields, onDone) {
    var cfg = window.GB_CONFIG;
    if (!cfg.buyerIntakeUrl) {
      try { console.error("[GrainBroker sell submit] intake not configured"); } catch (e) {}
      onDone(false);
      return;
    }
    var body = {
      type: "grower",
      name: fields.name || "",
      email: fields.email || "",
      phone: fields.phone || "",
      parcelDetails: fields.parcelDetails || "",
      source: "grainbroker.com.au/sell.html"
    };
    var headers = { "Content-Type": "application/json", "Accept": "application/json" };
    if (cfg.buyerIntakeSecret) headers["X-GrainBroker-Intake"] = cfg.buyerIntakeSecret;
    fetch(cfg.buyerIntakeUrl, { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (resp) {
        return resp.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) {}
          onDone(!!(resp.ok && data && data.ok));
        });
      })
      .catch(function () { onDone(false); });
  };

  window.gbSubmitBuyerCheck = function (fields, onDone) {
    var cfg = window.GB_CONFIG;
    if (!cfg.buyerCheckFormEndpoint) { onDone(false); return; }

    var data = new FormData();
    data.append("EMAIL", fields.email || "");
    data.append("BUYER_DEMAND", fields.demand || "");
    data.append("email_address_check", "");
    data.append("locale", "en");

    var endpoint = cfg.buyerCheckFormEndpoint.replace("/serve/", "/v2/serve/");

    fetch(endpoint, { method: "POST", body: data })
      .then(function (resp) { onDone(resp.ok); })
      .catch(function () { onDone(false); });
  };
})();
