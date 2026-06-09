<script setup lang="ts">
interface BrowseEntry {
  name: string;
  relPath: string;
  isDirectory: boolean;
}
interface BrowseResult {
  mountPath: string;
  relPath: string;
  breadcrumbs: { name: string; relPath: string }[];
  entries: BrowseEntry[];
}

const props = defineProps<{
  mountPath: string;
  initialRelPath?: string;
  commitLabel?: string;
}>();

const emit = defineEmits<{
  (e: "select", relPath: string): void;
  (e: "cancel"): void;
}>();

const browse = ref<BrowseResult | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

async function open(path: string) {
  busy.value = true;
  error.value = null;
  try {
    browse.value = await $fetch<BrowseResult>("/api/browse", {
      params: { mount: props.mountPath, path },
    });
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? (e as Error).message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => open(props.initialRelPath ?? ""));

const directories = computed(() =>
  (browse.value?.entries ?? []).filter((e) => e.isDirectory),
);

function commit() {
  if (browse.value) emit("select", browse.value.relPath);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="error" class="text-danger text-sm">{{ error }}</p>

    <nav class="flex flex-wrap items-center gap-1 text-sm">
      <template v-for="(bc, i) in browse?.breadcrumbs ?? []" :key="bc.relPath">
        <button
          class="btn-ghost px-2 py-1 text-sm"
          :class="i === (browse?.breadcrumbs.length ?? 1) - 1 ? 'font-bold text-fg' : ''"
          :disabled="busy"
          @click="open(bc.relPath)"
        >
          {{ bc.name }}
        </button>
        <span v-if="i < (browse?.breadcrumbs.length ?? 1) - 1" class="text-fg-dim">/</span>
      </template>
    </nav>

    <div
      v-if="busy && !browse"
      class="flex items-center justify-center gap-3 py-4 text-sm text-fg-dim"
    >
      <Spinner size="sm" /> <span>Loading…</span>
    </div>
    <ul
      v-else
      class="flex max-h-64 flex-col gap-1 overflow-y-auto rounded border border-border bg-surface-2 p-1"
    >
      <li v-for="e in directories" :key="e.relPath">
        <button class="row-button" :disabled="busy" @click="open(e.relPath)">
          <span aria-hidden="true" class="text-base">📁</span>
          <span class="flex-1 truncate text-left">{{ e.name }}/</span>
        </button>
      </li>
      <li
        v-if="!busy && directories.length === 0"
        class="py-2 text-center text-xs text-fg-dim"
      >
        No subfolders here.
      </li>
    </ul>

    <div class="flex gap-2">
      <button class="btn-primary flex-1" :disabled="busy" @click="commit">
        {{ commitLabel ?? "Use this folder" }}
      </button>
      <button class="btn-secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>
