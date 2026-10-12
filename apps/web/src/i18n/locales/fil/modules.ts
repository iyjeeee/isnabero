import type { Dictionary } from "../../translate";

export const modules: Dictionary["modules"] = {
  catalog: { label: "Katalogo", description: "Mga menu item, produkto at package na ginagamit ng POS at Booking." },
  pos: { label: "POS / Kahera", description: "Mag-ring ng benta at itala kung paano nagbayad ang customer." },
  booking: { label: "Booking", description: "Magreserba ng oras para sa mga customer." },
  expenses: { label: "Mga Gastos", description: "Subaybayan ang upa, kuryente at tubig, supplies at iba pang gastos (para sa mga owner at admin)." },
  inventory: { label: "Imbentaryo", description: "Subaybayan ang bilang ng stock; awtomatikong nababawasan sa benta at namarkahan ang kaunting stock." },
  scheduling: { label: "Iskedyul", description: "Magplano ng lingguhang shift ng staff; nakikita ng lahat ang iskedyul, ang mga owner at admin lang ang makaka-edit." },
  online_store: { label: "Online store", description: "Magbenta online (paparating pa lang)." },
};
