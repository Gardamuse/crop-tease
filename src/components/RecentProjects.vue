<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import UiIcon from './UiIcon.vue'
import {
  currentProjectId,
  deleteStoredProject,
  flushProject,
  loadRecentProjects,
  openStoredProject,
  projectThumbs,
  recentProjects,
  type ProjectEntry,
} from '@/lib/project'
import { DEFAULT_NAME } from '@/lib/constants'
import { clearContent } from '@/lib/store'

// The projects kept in this browser, shown in place of the sidebar's
// controls: open one, start a new one or open a file, or delete one.

const emit = defineEmits<{
  close: []
  new: []
  open: []
}>()

// the desktop builds (served from app://) keep projects in the app, not a browser
const WHERE = location.protocol === 'app:' ? 'in this app on this computer' : 'in this browser'

const loading = ref(true)
// a project being opened or deleted; the list waits for it
const busy = ref(false)

const displayName = (e: ProjectEntry) => e.name.trim() || DEFAULT_NAME

function whenEdited(updated: number): string {
  const date = new Date(updated)
  const today = new Date().toDateString() === date.toDateString()
  return today
    ? `Today ${date.toLocaleTimeString(undefined, { timeStyle: 'short' })}`
    : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

async function run(action: string, work: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await work()
  } catch (err) {
    console.error(err)
    alert(`${action} failed: ${err instanceof Error ? err.message : err}`)
  } finally {
    busy.value = false
  }
}

function onOpen(entry: ProjectEntry) {
  void run('Opening the project', async () => {
    await openStoredProject(entry.id)
    emit('close')
  })
}

function onDelete(entry: ProjectEntry) {
  const message =
    `Delete "${displayName(entry)}" from ${WHERE}? This can't be undone.\n\n` +
    `A copy you saved as a .ct file isn't affected.`
  if (!confirm(message)) return
  void run('Deleting the project', () => deleteStoredProject(entry.id, clearContent))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  try {
    await flushProject() // so the open project's entry and picture are current
    await loadRecentProjects()
  } catch (err) {
    console.error('Could not read the recent projects', err)
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <section class="recent" role="dialog" aria-label="Recent projects">
    <header class="recent-header">
      <button class="icon-button" title="Back (Esc)" aria-label="Back" @click="emit('close')">
        <UiIcon name="back" />
      </button>
      <h2>Recent projects</h2>
    </header>

    <div class="recent-actions">
      <button title="Start a new project; this one stays in the list" @click="emit('new')">
        <UiIcon name="new" />New project
      </button>
      <button title="Open a saved .ct project" @click="emit('open')"><UiIcon name="open" />Open file…</button>
    </div>

    <p class="recent-note">
      Recent projects are kept only {{ WHERE }}, and may disappear, for example when browsing data is cleared.
      Use <b class="nowrap">Save <UiIcon name="save" /></b> to keep a .ct file of any project you care about.
    </p>

    <ul class="recent-list" :class="{ busy }" :aria-busy="loading || busy">
      <li v-for="entry in recentProjects" :key="entry.id" :class="{ current: entry.id === currentProjectId }">
        <button
          class="recent-open"
          :title="entry.id === currentProjectId ? 'The open project' : `Open ${displayName(entry)}`"
          :disabled="busy"
          @click="onOpen(entry)"
        >
          <span class="recent-thumb">
            <img v-if="projectThumbs.get(entry.id)" :src="projectThumbs.get(entry.id)" alt="" />
          </span>
          <span class="recent-info">
            <span class="recent-name">{{ displayName(entry) }}</span>
            <span class="recent-meta">
              {{ whenEdited(entry.updated) }} &middot; {{ entry.pages }} {{ entry.pages === 1 ? 'page' : 'pages' }}
            </span>
            <span v-if="entry.id === currentProjectId" class="recent-badge">Open now</span>
          </span>
        </button>
        <button
          class="icon-button recent-delete"
          :title="`Delete ${displayName(entry)} from ${WHERE}`"
          :aria-label="`Delete ${displayName(entry)}`"
          :disabled="busy"
          @click="onDelete(entry)"
        >
          <UiIcon name="trash" />
        </button>
      </li>
    </ul>
    <p v-if="!loading && !recentProjects.length" class="recent-empty">No projects yet.</p>
  </section>
</template>

<style scoped lang="scss">
$side-pad: 18px;

.recent {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background: $bg-panel;
  animation: recent-in 0.18s ease-out;
}

@keyframes recent-in {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
}

button {
  @include ghost-button;
  font-size: 0.8rem;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  white-space: nowrap;
}

.icon-button {
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border-color: transparent;
  background: none;
  color: $text-dim;
  font-size: 1rem;

  &:hover:not(:disabled) {
    border-color: transparent;
    color: $accent-ink;
    filter: drop-shadow(0 0 6px $accent-soft);
  }
}

.recent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px $side-pad 14px;

  .icon-button {
    margin-left: -8px;
  }

  h2 {
    @include bar-heading;
    margin: 0;
    font-size: 1.1rem;
  }
}

.recent-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 $side-pad;
}

.recent-note {
  margin: 14px $side-pad 0;
  padding: 8px 10px;
  border-radius: $radius;
  border-left: 2px solid $accent;
  background: $accent-soft;
  font-size: 0.74rem;
  line-height: 1.45;
  color: $text-main;

  b {
    font-weight: 700;
  }

  .nowrap {
    white-space: nowrap;
  }

  .ui-icon {
    vertical-align: -0.2em;
  }
}

.recent-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 14px 0 0;
  padding: 0 $side-pad 18px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: $line transparent;

  &.busy {
    cursor: progress;
  }

  li {
    position: relative;

    &:hover .recent-delete,
    &:focus-within .recent-delete {
      opacity: 1;
    }
  }
}

.recent-open {
  width: 100%;
  justify-content: flex-start;
  gap: 12px;
  padding: 8px;
  background: $bg-panel-alt;
  text-align: left;
  white-space: normal;

  .current & {
    border-color: $accent;
    box-shadow: 0 0 0 1px $accent-soft;
  }
}

.recent-thumb {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 90px;
  border-radius: 2px;
  background: $dark-void;
  overflow: hidden;

  img {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
}

.recent-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding-right: 28px; // room for the delete button
}

.recent-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  font-size: 0.85rem;
  color: $text-main;
}

.recent-meta {
  font-size: 0.72rem;
  color: $text-dim;
}

.recent-badge {
  @include micro-label;
  color: $accent-ink;
}

.recent-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.15s;

  &:hover:not(:disabled) {
    color: $danger;
    filter: none;
  }
}

.recent-empty {
  margin: 0 $side-pad;
  font-size: 0.8rem;
  color: $text-dim;
}
</style>
