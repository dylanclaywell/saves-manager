<script setup lang="ts">
interface SlotResolved {
  slotKey: "slotA" | "slotB";
  deviceNickname: string;
  fileRelPath: string;
  mounted: boolean;
  exists: boolean;
  directoryMode?: boolean;
  pendingFileName?: string | null;
}

const props = defineProps<{
  slotLetter: "A" | "B";
  encodedName: string;
  fileRelPath?: string;
  subtitle: string;
  resolved: SlotResolved | null;
}>();

const slotKey = computed(() => (props.slotLetter === "A" ? "slotA" : "slotB"));
const configureHref = computed(
  () => `/profiles/${props.encodedName}/slot/${slotKey.value}`,
);

const statusPill = computed(() => {
  const r = props.resolved;
  if (!r) return null;
  if (!r.mounted) {
    return {
      text: "absent",
      cls: "bg-[color-mix(in_oklab,var(--color-warn)_25%,transparent)] text-warn",
    };
  }
  if (r.directoryMode) {
    return {
      text: r.pendingFileName ? "ready to receive" : "folder (waiting)",
      cls: "bg-[color-mix(in_oklab,var(--color-accent)_25%,transparent)] text-accent",
    };
  }
  if (r.exists) {
    return {
      text: "present",
      cls: "bg-[color-mix(in_oklab,var(--color-ok)_25%,transparent)] text-ok",
    };
  }
  return {
    text: "missing",
    cls: "bg-[color-mix(in_oklab,var(--color-danger)_25%,transparent)] text-danger",
  };
});
</script>

<template>
  <div class="card flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="flex items-baseline gap-2">
        <span
          class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-sm font-bold"
          >{{ slotLetter }}</span
        >
        <p class="font-semibold">
          {{ resolved ? resolved.deviceNickname : "Slot " + slotLetter }}
        </p>
      </div>
      <span v-if="statusPill" class="pill" :class="statusPill.cls">
        {{ statusPill.text }}
      </span>
      <span v-else class="pill bg-surface-2 text-fg-dim">empty</span>
    </div>

    <p v-if="fileRelPath" class="break-all text-sm text-fg-dim">
      <span v-if="resolved?.directoryMode" class="mr-1">📂</span>
      /{{ fileRelPath }}{{ resolved?.directoryMode ? "/" : "" }}
    </p>

    <p
      v-if="resolved?.directoryMode && resolved.mounted && resolved.pendingFileName"
      class="text-sm text-warn"
    >
      File <span class="font-semibold">{{ resolved.pendingFileName }}</span>
      does not exist on
      <span class="font-semibold">{{ resolved.deviceNickname }}</span> — will be
      created as <span class="font-mono">{{ resolved.pendingFileName }}</span> on transfer.
    </p>

    <p class="text-xs text-fg-dim">{{ subtitle }}</p>

    <NuxtLink :to="configureHref" class="btn-secondary self-start">
      {{ resolved ? "Replace" : "Configure" }}
    </NuxtLink>
  </div>
</template>
