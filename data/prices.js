// GrainBroker indicative prices. Updated from the daily bid sheets.
// This file is rewritten each morning (automated once live). Do not hand-edit format.
window.GB_PRICES = {
  updated: "7 July 2026, 7:05am AEST",
  disclaimer: "Indicative track prices only. Markets move through the day. Call us for a firm bid.",
  zones: [
    {
      zone: "Northern NSW (Newcastle track)",
      rows: [
        { commodity: "Wheat", grade: "APW1", price: 342 },
        { commodity: "Wheat", grade: "H2", price: 356 },
        { commodity: "Barley", grade: "F1", price: 298 },
        { commodity: "Canola", grade: "CAN1", price: 684 },
        { commodity: "Sorghum", grade: "SOR1", price: 318 }
      ]
    },
    {
      zone: "Southern NSW (Port Kembla track)",
      rows: [
        { commodity: "Wheat", grade: "APW1", price: 338 },
        { commodity: "Wheat", grade: "ASW1", price: 326 },
        { commodity: "Barley", grade: "F1", price: 295 },
        { commodity: "Canola", grade: "CAN1", price: 679 }
      ]
    },
    {
      zone: "Queensland (Brisbane track)",
      rows: [
        { commodity: "Wheat", grade: "APW1", price: 349 },
        { commodity: "Sorghum", grade: "SOR1", price: 324 },
        { commodity: "Barley", grade: "F1", price: 305 }
      ]
    },
    {
      zone: "Victoria (Geelong/Melbourne track)",
      rows: [
        { commodity: "Wheat", grade: "APW1", price: 334 },
        { commodity: "Barley", grade: "MALT1", price: 341 },
        { commodity: "Canola", grade: "CAN1", price: 675 }
      ]
    }
  ]
};
