/**
 * The prayer to suggest for each weekday, as plain literals.
 *
 * Home shows this under the Devocionário row, and Home is on the first-load
 * path — importing the corpus for one title would drag every prayer into the
 * initial bundle and undo the code split. The titles are copied rather than
 * looked up, and a test asserts they still match the corpus.
 *
 * Indexed like `Date.getDay()` (0 = Sunday), following the Church's devotion
 * for each day — the same one the Intenções card shows under "Hoje".
 */
export const WEEKDAY_SUGGESTIONS: readonly { id: string; title: string }[] = [
    { id: 'te-deum', title: 'Te Deum' },                                            // domingo
    { id: 'eterno-descanso', title: 'Eterno descanso' },                            // segunda
    { id: 'anjo-da-guarda', title: 'Santo Anjo do Senhor' },                        // terça
    { id: 'ladainha-de-sao-jose', title: 'Ladainha de São José' },                  // quarta
    { id: 'adoro-te-devote', title: 'Adoro-Vos com devoção' },                      // quinta
    { id: 'via-sacra', title: 'Via-Sacra' },                                        // sexta
    { id: 'ladainha-de-nossa-senhora', title: 'Ladainha de Nossa Senhora' },        // sábado
];

/** The suggestion for today, without touching the corpus. */
export function suggestedPrayer(now: Date = new Date()): { id: string; title: string } {
    return WEEKDAY_SUGGESTIONS[now.getDay()];
}
