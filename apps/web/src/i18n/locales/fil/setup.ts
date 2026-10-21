import type { Dictionary } from "../../translate";

export const setup: Dictionary["setup"] = {
  welcomeTitle: "Welcome — i-setup natin ang negosyo mo",
  welcomeDescription: "Apat na mabilis na hakbang para iangkop ang Isnabero sa paraan ng trabaho mo.",
  description: "I-update ang pangalan ng negosyo, mga module at detalye ng receipt.",
  progress: "Progreso ng setup",
  steps: { business: "Negosyo", modules: "Mga module", review: "Rebyu", receipt: "Detalye ng receipt" },
  business: {
    name: "Pangalan ng negosyo",
    nameHint: "Makikita sa sidebar at sa mga pahina mo.",
    nameRequired: "Kailangan ang pangalan ng negosyo.",
    nameTooLong: "Hindi dapat lumampas sa {max} na karakter ang pangalan ng negosyo.",
  },
  modules: {
    hint: "I-on ang mga feature na kailangan ng negosyong ito. Laging kasama ang mga tala ng bayad, empleyado, at ulat.",
    neededBy: "Kailangan ng {modules}",
    switchAria: "Module ng {module}",
  },
  review: {
    none: "Wala — mga laging naka-on na feature lang ang makikita.",
    later: "Puwede mo itong baguhin anumang oras sa Mga Setting → Pag-setup ng Negosyo.",
  },
  saved: "Na-save ang business setup",
  finish: "Tapusin ang setup",
};
