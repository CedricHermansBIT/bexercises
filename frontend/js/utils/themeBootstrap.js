// Loaded synchronously in <head>, before stylesheets and the first page paint.
(() => {
    const themes = ['dark', 'light', 'high-contrast', 'pink', 'dracula', 'paper', 'nord', 'solarized'];
    let savedTheme;
    try {
        savedTheme = localStorage.getItem('bitlab-theme');
        document.documentElement.classList.toggle('experimental-view', localStorage.getItem('bitlab-experimental-view') === 'true');
    } catch {
        // Use the system preference when browser storage is unavailable.
    }

    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = themes.includes(savedTheme) ? savedTheme : savedTheme ? 'dark' : systemTheme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = ['light', 'paper', 'pink', 'nord'].includes(theme) ? 'light' : 'dark';
})();
