import type { Dictionary } from "../../translate";

export const auth: Dictionary["auth"] = {
  tagline: "Mag-log in sa iyong negosyo",
  email: "Email",
  password: "Password",
  signIn: "Mag-log in",
  signingIn: "Naglo-log in…",
  noBusiness: {
    title: "Walang negosyong naka-link sa account na ito",
    description: "Hindi pa empleyado ng alinmang negosyo ang {email}. Hilingin sa may-ari na idagdag ka, saka mag-log in ulit.",
    signOut: "Mag-sign out",
  },
  mockModeError: "Para makapag-log in, kailangan ang VITE_DATA_SOURCE=supabase at isang gumaganang Supabase project.",
};
