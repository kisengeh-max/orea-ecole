// Valeurs de ORÉA École (v40).
// La clé "publishable" Supabase peut être publique. N'utilise JAMAIS la clé "secret" ni "service_role".
//
// GEMINI_KEY : colle ta clé Google AI Studio à la place de XXX (garde les guillemets).
//   ⚠ Cette clé est visible dans le navigateur. Elle est restreinte à l'API Generative Language.
//   Plus tard, on pourra la déplacer dans une Supabase Edge Function (voir récapitulatif final).
// GEMINI_MODEL : nom du modèle. Si l'app affiche « modèle introuvable », vérifie ce nom ici.
window.OREA_CONFIG={
  SUPABASE_URL:"https://llmqzbomgkgayvhndubn.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_lY1lrnM0Fu5TDhVRg-JrVQ_Fp8S4eIW",
  APP_VERSION:"v40",
  GEMINI_KEY:"XXX",
  GEMINI_MODEL:"gemini-3.8-flash"
};
