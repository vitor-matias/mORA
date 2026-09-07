/**
 * The colour the installed app launches on: the manifest's theme_color and
 * background_color, which paint the splash and, on Android 15+, the strip
 * under the status bar for as long as the app is open (see statusBar.ts).
 *
 * One value for the manifest and the app, so the two cannot drift. The
 * pre-paint script in index.html repeats it by necessity — it runs before
 * any module — so keep that hex literal in step with this one.
 */
export const LAUNCH_COLOR = '#FAF9F6';
