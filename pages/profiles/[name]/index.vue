<script setup lang="ts">
import { formatBytes, formatRelativeTime } from "~/composables/useFormat";

const route = useRoute();
const router = useRouter();
const rawName = computed(() => decodeURIComponent(route.params.name as string));

interface SlotResolved {
  slotKey: "slotA" | "slotB";
  deviceNickname: string;
  fileRelPath: string;
  mounted: boolean;
  exists: boolean;
  directoryMode?: boolean;
  pendingFileName?: string | null;
  sizeBytes?: number;
  mtimeMs?: number;
}
interface ResolveResponse {
  name: string;
  ready: boolean;
  slotA: SlotResolved | null;
  slotB: SlotResolved | null;
}

const encName = computed(() => encodeURIComponent(rawName.value));
const { data: resolveData, refresh, pending } = await useFetch<ResolveResponse>(
  () => `/api/profiles/${encName.value}/resolve`,
);

const slotA = computed(() => resolveData.value?.slotA ?? null);
const slotB = computed(() => resolveData.value?.slotB ?? null);
const ready = computed(() => resolveData.value?.ready ?? false);
const bothMounted = computed(() => !!slotA.value?.mounted && !!slotB.value?.mounted);

const transferError = ref<string | null>(null);
const transferResult = ref<{
  destinationPath: string;
  bytesCopied: number;
  backupPath: string | null;
  promotedSlot: { slotKey: "slotA" | "slotB"; fileRelPath: string } | null;
} | null>(null);
const transferring = ref(false);
const showConfirm = ref<null | "AtoB" | "BtoA">(null);

const suggestion = computed<null | "AtoB" | "BtoA">(() => {
  const a = slotA.value;
  const b = slotB.value;
  if (!a || !b) return null;
  // Directory-mode slots can never be a source — they have no file yet.
  const aCanSource = !a.directoryMode && a.exists;
  const bCanSource = !b.directoryMode && b.exists;
  if (aCanSource && !bCanSource) return "AtoB";
  if (bCanSource && !aCanSource) return "BtoA";
  if (a.mtimeMs && b.mtimeMs) {
    if (a.mtimeMs > b.mtimeMs) return "AtoB";
    if (b.mtimeMs > a.mtimeMs) return "BtoA";
  }
  return null;
});

async function runTransfer(direction: "AtoB" | "BtoA") {
  transferring.value = true;
  transferError.value = null;
  transferResult.value = null;
  try {
    transferResult.value = await $fetch(`/api/profiles/${encName.value}/transfer`, {
      method: "POST",
      body: { direction },
    });
    await refresh();
  } catch (e) {
    transferError.value = (e as { statusMessage?: string }).statusMessage ?? (e as Error).message;
  } finally {
    transferring.value = false;
    showConfirm.value = null;
  }
}

async function deleteProfile() {
  if (!confirm(`Delete profile "${rawName.value}"? Save files on devices are untouched.`)) return;
  await $fetch(`/api/profiles/${encName.value}`, { method: "DELETE" });
  router.push("/");
}

function slotSubtitle(s: SlotResolved | null): string {
  if (!s) return "Not configured";
  if (!s.mounted) return `${s.deviceNickname} — not mounted`;
  if (s.directoryMode) {
    if (s.pendingFileName) {
      return `${s.deviceNickname} — folder · will be created as ${s.pendingFileName}`;
    }
    return `${s.deviceNickname} — folder · waiting for the other slot to provide a file`;
  }
  if (!s.exists) return `${s.deviceNickname} — file missing on device`;
  return `${s.deviceNickname} — ${formatBytes(s.sizeBytes)} · ${formatRelativeTime(s.mtimeMs)}`;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h1 class="text-xl font-bold">{{ rawName }}</h1>
      <p
        class="text-sm"
        :class="ready ? 'text-ok' : 'text-warn'"
      >
        {{ ready ? "Ready to transfer" : "Configure both slots to enable transfer" }}
      </p>
    </header>

    <div v-if="pending && !resolveData" class="flex items-center justify-center gap-3 py-8 text-fg-dim">
      <Spinner /> <span>Resolving slots…</span>
    </div>

    <section v-else class="flex flex-col gap-3">
      <SlotPanel
        slot-letter="A"
        :resolved="slotA"
        :encoded-name="encName"
        :file-rel-path="slotA?.fileRelPath"
        :subtitle="slotSubtitle(slotA)"
      />
      <SlotPanel
        slot-letter="B"
        :resolved="slotB"
        :encoded-name="encName"
        :file-rel-path="slotB?.fileRelPath"
        :subtitle="slotSubtitle(slotB)"
      />
    </section>

    <section v-if="ready" class="card flex flex-col gap-3">
      <div>
        <p class="font-semibold">Transfer</p>
        <p class="text-xs text-fg-dim">
          A timestamped backup of the destination file is saved before any overwrite.
        </p>
      </div>

      <div v-if="!bothMounted" class="text-sm text-warn">
        Both devices must be mounted to transfer.
        <button class="btn-ghost ml-2 px-2 py-1 text-xs" @click="refresh()">Recheck</button>
      </div>

      <div v-else class="flex flex-col gap-2">
        <p v-if="suggestion" class="text-xs text-fg-dim">
          Suggestion: <span class="font-semibold text-fg">
            {{ suggestion === "AtoB" ? "A → B" : "B → A" }}
          </span>
        </p>

        <button
          class="btn-secondary"
          :disabled="!slotA?.exists || slotA?.directoryMode || transferring"
          @click="showConfirm = 'AtoB'"
        >
          A → B
          <span class="text-xs text-fg-dim">
            ({{ slotA?.deviceNickname }} → {{ slotB?.deviceNickname }})
          </span>
        </button>
        <button
          class="btn-secondary"
          :disabled="!slotB?.exists || slotB?.directoryMode || transferring"
          @click="showConfirm = 'BtoA'"
        >
          B → A
          <span class="text-xs text-fg-dim">
            ({{ slotB?.deviceNickname }} → {{ slotA?.deviceNickname }})
          </span>
        </button>
      </div>

      <div v-if="transferResult" class="rounded-xl border border-ok bg-[color-mix(in_oklab,var(--color-ok)_15%,transparent)] p-3 text-sm">
        <p class="font-semibold text-ok">Transfer complete</p>
        <p class="break-all text-fg-dim">
          {{ formatBytes(transferResult.bytesCopied) }} → {{ transferResult.destinationPath }}
        </p>
        <p v-if="transferResult.promotedSlot" class="text-xs text-accent">
          Slot {{ transferResult.promotedSlot.slotKey === "slotA" ? "A" : "B" }}
          now points at <span class="font-mono">{{ transferResult.promotedSlot.fileRelPath }}</span>
          — future transfers can go either way.
        </p>
        <p v-if="transferResult.backupPath" class="break-all text-xs text-fg-dim">
          Backup: {{ transferResult.backupPath }}
        </p>
      </div>

      <p v-if="transferError" class="text-danger">{{ transferError }}</p>
    </section>

    <div class="flex justify-between gap-2 pt-2">
      <button class="btn-ghost" :disabled="pending" @click="refresh()">
        <Spinner v-if="pending" size="sm" />
        <span>{{ pending ? "Refreshing…" : "Refresh" }}</span>
      </button>
      <button class="btn-danger" @click="deleteProfile">Delete profile</button>
    </div>

    <TransferConfirm
      v-if="showConfirm"
      :direction="showConfirm"
      :slot-a="slotA"
      :slot-b="slotB"
      :busy="transferring"
      @cancel="showConfirm = null"
      @confirm="runTransfer(showConfirm!)"
    />
  </div>
</template>
