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
    growerFormEndpoint: "https://4e07af79.sibforms.com/serve/MUIFAMfu_AcTTe7m14k051CEuPO2NEdtOU5ClzRMZhbtZTtChqxlbCjTtgoIvv2r5KxUKCafKCDq_ndI9zOSpHHIZubMceSsaurG1SmXkkNUdQygbD_IJpuGwGddw38keZ_0RGLdjacFA8VSIzI-yZm9ytJdRlxzJuFCCIHQPxmbZQDdzyPmePPwXaiGOM9Ffx6q34pbmFSpvvJOYg==",
    // Buyer intake (buy.html) posts to Grain Broker GHL form "Buyer Needs"
    // (ydhWyeSBO8IfFxYPCQRS). Public submit requires Cloudflare Turnstile token.
    buyerFormEndpoint: "https://backend.leadconnectorhq.com/forms/submit",
    buyerGhlFormId: "ydhWyeSBO8IfFxYPCQRS",
    buyerGhlLocationId: "DJQBTIQasTdt54iPJuny",
    // GHL's invisible Turnstile site key (from LeadConnector form widget).
    buyerTurnstileSiteKey: "0x4AAAAAACCpVlau-4k7cJ33",
    // Inbound webhook backup (no Turnstile). Set when workflow is live.
    buyerWebhookUrl: "",
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

  // Prefer inbound webhook (no Turnstile). Else GHL forms/submit + Turnstile.
  window.gbSubmit = function (summary, payload, onDone) {
    var cfg = window.GB_CONFIG;
    payload = payload || {};
    function fail(msg) {
      try { console.error("[GrainBroker buy submit]", msg); } catch (e) {}
      onDone(false, msg || "Submit failed");
    }
    function ok() { onDone(true, null); }

    if (cfg.buyerWebhookUrl) {
      var body = {
        email: payload.EMAIL || "",
        phone: payload.PHONE || "",
        full_name: payload.CONTACT || "",
        company: payload.COMPANY || "",
        needs: buildBuyerNeedsText(payload) || String(summary || ""),
        commodity: payload.COMMODITY || "",
        grade: payload.GRADE || "",
        tonnes: payload.TONNES || "",
        delivery: payload.DELIVERY || "",
        window: payload.WINDOW || "",
        notes: payload.NOTES || "",
        source: "grainbroker.com.au/buy.html"
      };
      fetch(cfg.buyerWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(body)
      }).then(function (resp) {
        if (resp.ok || resp.type === "opaque") { ok(); return; }
        return resp.text().then(function (text) {
          fail("Webhook HTTP " + resp.status + (text ? (": " + text.slice(0, 180)) : ""));
        });
      }).catch(function () {
        // CORS fallback: GET with query string (Inbound Webhook supports GET)
        var q = new URLSearchParams();
        Object.keys(body).forEach(function (k) { if (body[k] != null && body[k] !== "") q.set(k, body[k]); });
        var url = cfg.buyerWebhookUrl + (cfg.buyerWebhookUrl.indexOf("?") >= 0 ? "&" : "?") + q.toString();
        fetch(url, { method: "GET", mode: "no-cors", cache: "no-store" })
          .then(function () { ok(); })
          .catch(function (err) { fail((err && err.message) || "Webhook network error"); });
      });
      return;
    }

    if (!cfg.buyerFormEndpoint || !cfg.buyerGhlFormId || !cfg.buyerGhlLocationId) {
      fail("Form not configured");
      return;
    }

    getTurnstileToken(cfg.buyerTurnstileSiteKey, function (terr, token, waitedMs) {
      if (terr || !token) {
        fail("Security check failed (" + ((terr && terr.message) || "no token") + ") — refresh and try again");
        return;
      }
      postBuyerToGhl(summary, payload, token, waitedMs, function (success, errMsg) {
        if (success) ok();
        else fail(errMsg || "GHL submit rejected");
      });
    });
  };

  window.gbSubmitGrower = function (fields, onDone) {
    var cfg = window.GB_CONFIG;
    if (!cfg.growerFormEndpoint) { onDone(false); return; }

    var data = new FormData();
    data.append("EMAIL", fields.email || "");
    data.append("SMS", auPhone(fields.phone));
    data.append("FIRSTNAME", fields.name || "");
    data.append("PARCEL_DETAILS", fields.parcelDetails || "");
    data.append("email_address_check", "");
    data.append("locale", "en");

    var endpoint = cfg.growerFormEndpoint.replace("/serve/", "/v2/serve/");

    fetch(endpoint, { method: "POST", body: data })
      .then(function (resp) { onDone(resp.ok); })
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
