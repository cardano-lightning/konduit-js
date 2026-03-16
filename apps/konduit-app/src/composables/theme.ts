import { ref, watchEffect, onMounted } from 'vue';

type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'theme-mode';
const theme = ref<ThemeMode>('system');

function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function applySystemPreference() {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const prefers = mq.matches ? 'light' : 'dark';
  document.documentElement.dataset.prefersColor = prefers;

  // Keep it updated if system changes
  mq.addEventListener('change', (e) => {
    document.documentElement.dataset.prefersColor = e.matches ? 'light' : 'dark';
  });
}

export function useTheme() {
  onMounted(() => {
    theme.value = getStoredTheme();
    applySystemPreference();
  });

  watchEffect(() => {
    const t = theme.value;
    document.documentElement.dataset.theme = t;
    localStorage.setItem(THEME_KEY, t);
  });

  return {
    theme,
    setTheme: (t: ThemeMode) => (theme.value = t),
  };
}


