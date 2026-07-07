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
    var data = new FormData()