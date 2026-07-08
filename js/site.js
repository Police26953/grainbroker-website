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
    // Buyer form endpoint pending (buyers list form not created yet) — falls back to email.
    buyerFormEndpoint: "",
    // Daily buyer market-check endpoint. Pending: Jack needs to create a Brevo subscription
    // form on list #3 "Grain Broker - Buyers" (update existing contacts, fields EMAIL +
    // custom attribute BUYER_DEMAND) and paste the resulting sibforms serve URL in here.
    buyerCheckFormEndpoint: "https://4e07af79.sibforms.com/serve/MUIFAF4JSYeF1sh00OXN8UCwc5-V_9Gl-KVslk6Bmds0o6XTDv8CU5p_zwNTYeUxoSco4CtYM5mCoXR5SSCDCCZ4NGhZpNCQ8ZTjmRTGpT3YMgv94WgN4CDnsUq7dWKkKoHMf0-ShJ6tlaOs9XuyWuG5BRJu4gqSdT_5rFeewo0pLa_CUeOmK2UGS2kSKMB8_HhJyriaWa0Kk_yWnQ==",
    fallbackEmail: "info@grainbroker.com.au",
    phoneDisplay: "0414 503 466"
  };

  // Convert an Australian phone number to Brevo SMS format (61XXXXXXXXX, no +/leading 0).
  function auPhone(raw) {
    var d = (raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.slice(0, 2) === "61") return d;
    if (d.charAt(0) === "0") return "61" + d.slice(1);
    if (d.length === 9) return "61" + d;
    return "";
  }

  // Submit a grower registration to Brevo: contact fields + full parcel summary.
  // fields: { name, email, phone, parcelDetails }
  window.gbSubmitGrower = function (fields, onDone) {
    var cfg = window.GB_CONFIG;
    if (!cfg.growerFormEndpoint) { onDone(false); return; }

    var data = new FormData();
    data.append("EMAIL", fields.email || "");
    data.append("SMS", auPhone(fields.phone));
    data.append("FIRSTNAME", fields.name || "");
    data.append("PARCEL_DETAILS", fields.parcelDetails || "");
    data.append("email_address_check", ""); // honeypot: must stay empty
    data.append("locale", "en");

    // Brevo's /serve/ endpoint 302s to /v2/serve/; posting straight to the
    // resolved URL avoids browsers dropping the POST body on that redirect.
    var endpoint = cfg.growerFormEndpoint.replace("/serve/", "/v2/serve/");

    fetch(endpoint, { method: "POST", body: data })
      .then(function (resp) { onDone(resp.ok); })
      .catch(function () { onDone(false); });
  };

  // Submit a daily buyer market-check response to Brevo: updates the existing buyer
  // contact's BUYER_DEMAND attribute. Does not create new contacts — buyer must already
  // be on the Buyers list. fields: { email, demand }
  window.gbSubmitBuyerCheck = function (fields, onDone) {
    var cfg = window.GB_CONFIG;
    if (!cfg.buyerCheckFormEndpoint) { onDone(false); return; }

    var data = new FormData();
    data.append("EMAIL", fields.email || "");
    data.append("BUYER_DEMAND", fields.demand || "");
    data.append("email_address_check", ""); // honeypot: must stay empty
    data.append("locale", "en");

    var endpoint = cfg.buyerCheckFormEndpoint.replace("/serve/", "/v2/serve/");

    fetch(endpoint, { method: "POST", body: data })
      .then(function (resp) { onDone(resp.ok); })
      .catch(function () { onDone(false); });
  };
})();
