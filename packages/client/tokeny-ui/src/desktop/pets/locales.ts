/** Companion settings and accessible interaction labels. */
export const zh = {
  title: '输入框宠物', enabled: '显示输入框宠物', skin: '宠物皮肤', sleeping: '宠物睡眠',
  hint: '点击摸摸，右键可散步、睡觉或隐藏。', pet: '摸摸', walk: '散步', sleep: '睡觉', wake: '叫醒', hide: '隐藏宠物',
  idle: '陪伴中', thinking: '正在思考', working: '正在处理', attention: '等待你的操作',
  saveError: '宠物设置未能保存，当前窗口仍会使用所选设置。', retry: '重试保存',
  'orange-cat': '小橘', 'tokeny-cow': '牛牛', octopus: '章鱼丸', 'ai-robot': 'AI 机器人',
  'rover-vacuum': '扫地机器人', 'marshmallow-ghost': '糯米幽灵', 'rainbow-cloud': '棉花云',
}

/** English labels matching the companion controls. */
export const en: Record<keyof typeof zh, string> = {
  title: 'Input companion', enabled: 'Show input companion', skin: 'Companion skin', sleeping: 'Companion sleep',
  hint: 'Click to pet. Right-click to walk, sleep, or hide.', pet: 'Pet', walk: 'Walk', sleep: 'Sleep', wake: 'Wake', hide: 'Hide companion',
  idle: 'Keeping you company', thinking: 'Thinking', working: 'Working', attention: 'Waiting for you',
  saveError: 'Your companion settings could not be saved. This window will keep using them.', retry: 'Retry saving',
  'orange-cat': 'Orange cat', 'tokeny-cow': 'Cow', octopus: 'Octopus', 'ai-robot': 'AI robot',
  'rover-vacuum': 'Rover vacuum', 'marshmallow-ghost': 'Marshmallow ghost', 'rainbow-cloud': 'Rainbow cloud',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Composer companion labels. */
    'tokenyUI.pet': keyof typeof zh
  }
}
