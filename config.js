// Valeurs de ORÉA École (v40).
// La clé "publishable" Supabase peut être publique. N'utilise JAMAIS la clé "secret" ni "service_role".
//
// GEMINI_KEY : ta clé Google AI Studio (les nouvelles clés commencent par AQ.Ab8...).
//   ⚠ Cette clé est visible dans le navigateur. Elle est restreinte à l'API Generative Language.
//   Plus tard, on pourra la déplacer dans une Supabase Edge Function (voir récapitulatif final).
// GEMINI_MODEL : nom du modèle. gemini-2.5-flash est le modèle actuel recommandé par Google.
window.OREA_CONFIG={
  SUPABASE_URL:"https://llmqzbomgkgayvhndubn.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_lY1lrnM0Fu5TDhVRg-JrVQ_Fp8S4eIW",
  APP_VERSION:"v40",
  GEMINI_KEY:"AQ.Ab8RN6LrWKMwc71E04t4eAmgfFyFMq4tHm4e3tVmPEcHNEQofw",
  GEMINI_MODEL:"gemini-2.5-flash"
};
