/**
 * Inline, render-blocking theme bootstrap. Runs before paint so there is no
 * flash of the wrong theme on first load. Honours a saved choice, else the OS
 * preference, defaulting to dark (the terminal default).
 */
export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem('of-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
