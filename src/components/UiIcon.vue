<script lang="ts">
// Line icons on a 24-unit grid, drawn with the current text color.
const PATHS = {
  new: 'M6 3h8l4 4v14H6z M14 3v4h4 M12 11v6 M9 14h6',
  open: 'M3 7V5h7l2 2h9v12H3z M3 10h18',
  save: 'M5 3h11l3 3v15H5z M8 3v5h7V3 M8 21v-7h8v7',
  export: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  split: 'M4 4h16v16H4z M14 4l-4 16',
  closeUp: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
  text: 'M4 5h16v11H10l-5 4v-4H4z M8 9h8 M8 12h5',
  hash: 'M9 4L7 20 M17 4l-2 16 M4 9h17 M3 15h17',
  help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7 M12 17h.01',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  rotate: 'M19.52 14.74A8 8 0 1 1 17.66 6.34 M20 4v5h-5',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  unlink:
    'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71 M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71 M8 2v3 M2 8h3 M16 22v-3 M22 16h-3',
} as const

export type IconName = keyof typeof PATHS
</script>

<script setup lang="ts">
defineProps<{ name: IconName }>()
</script>

<template>
  <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="PATHS[name]" />
  </svg>
</template>

<style scoped lang="scss">
.ui-icon {
  flex: none;
  width: 1.15em;
  height: 1.15em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
