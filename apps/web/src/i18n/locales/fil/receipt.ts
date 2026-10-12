import type { Dictionary } from "../../translate";

export const receipt: Dictionary["receipt"] = {
  dialog: {
    title: "Receipt",
    description: "I-print para sa customer o i-save ang kopya bilang PDF.",
    notFound: "Walang nakitang receipt para sa bayad na ito.",
    pdfError: "Hindi nagawa ang PDF. Subukan ulit.",
    preparing: "Inihahanda…",
    downloadPdf: "I-download ang PDF",
    print: "I-print",
  },
  details: {
    title: "Detalye ng receipt",
    description: "Lalabas sa bawat sales receipt. Iwanang blangko ang field para hindi ito isama.",
    address: "Address",
    tin: "TIN",
    contact: "Numero ng contact",
    footer: "Mensahe sa ibaba",
    footerPlaceholder: "Salamat! Balik kayo ulit.",
    disclaimer: "Ang mga receipt mula sa Isnabero ay sales receipt. Hindi ito BIR-registered official receipt at nakasulat ito sa ibaba ng receipt.",
    submit: "I-save ang detalye ng receipt",
    saved: "Na-save ang detalye ng receipt",
  },
};
