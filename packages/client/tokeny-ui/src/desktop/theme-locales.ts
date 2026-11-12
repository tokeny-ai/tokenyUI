/** Theme panel strings; palette names preserve Tokeny's built-in catalog. */
export const zh = {
  title: '主题与外观', close: '关闭主题面板', mode: '外观模式', modeLight: '浅色', modeDark: '深色', modeSystem: '跟随系统',
  lightThemes: '浅色主题', darkThemes: '深色主题', selected: '正在使用', hint: '跟随系统时，会自动使用你上次选定的浅色或深色主题。',
  saveError: '主题选择未能保存，当前窗口仍会使用所选主题。', retry: '重试保存',
  light: '浅色', 'ice-blue': '冰蓝', 'warm-amber': '牛黄', 'claude-code-light': 'Claude Code Light',
  'solarized-light': 'Solarized Light', 'github-light': 'GitHub Light', paper: '纸质', dark: '深色',
  'claude-code-dark': 'Claude Code Dark', nord: 'Nord', 'solarized-dark': 'Solarized Dark', dracula: 'Dracula',
  'one-dark': 'One Dark', 'github-dark': 'GitHub Dark', 'warm-night': '暖夜',
}

/** English labels for the same mode choices and Tokeny palettes. */
export const en: Record<keyof typeof zh, string> = {
  title: 'Themes and appearance', close: 'Close theme panel', mode: 'Appearance mode', modeLight: 'Light', modeDark: 'Dark', modeSystem: 'System',
  lightThemes: 'Light themes', darkThemes: 'Dark themes', selected: 'Active', hint: 'System mode automatically uses your last selected light or dark theme.',
  saveError: 'Your theme choice could not be saved. This window will keep using it.', retry: 'Retry saving',
  light: 'Light', 'ice-blue': 'Ice Blue', 'warm-amber': 'Warm Amber', 'claude-code-light': 'Claude Code Light',
  'solarized-light': 'Solarized Light', 'github-light': 'GitHub Light', paper: 'Paper', dark: 'Dark',
  'claude-code-dark': 'Claude Code Dark', nord: 'Nord', 'solarized-dark': 'Solarized Dark', dracula: 'Dracula',
  'one-dark': 'One Dark', 'github-dark': 'GitHub Dark', 'warm-night': 'Warm Night',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tokeny palette and mode controls. */
    'tokenyUI.themes': keyof typeof zh
  }
}
