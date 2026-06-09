<script setup lang="ts">
import { formatDuration, formatRelativeIso } from "~/composables/useFormat";
import { systemFallbackBackground } from "~/composables/useGameVisuals";

/** Minimal shape this card needs. Pages can pass their full AggregatedGame —
 *  the extra fields are ignored. */
interface GameCardData {
  normalizedName: string;
  displayName: string;
  system?: string;
  cores?: string[];
  totalSeconds: number;
  lastPlayedAt?: string;
  hasThumbnail: boolean;
}

const props = defineProps<{
  game: GameCardData;
}>();

const fallbackBackground = computed(() =>
  systemFallbackBackground(
    props.game.system ?? props.game.cores?.[0] ?? "unknown",
  ),
);

const thumbnailUrl = computed(
  () => `/api/thumbnails/${encodeURIComponent(props.game.normalizedName)}`,
);
</script>

<template>
  <NuxtLink
    :to="`/activity/${encodeURIComponent(game.normalizedName)}`"
    class="group relative aspect-square overflow-hidden rounded-[10%] bg-surface-2 ring-1 ring-border/60 transition-transform active:scale-[0.98] hover:ring-accent/60"
  >
    <!-- Fallback gradient — always rendered so the squircle isn't blank
         while the <img> loads. -->
    <div class="absolute inset-0" :style="{ background: fallbackBackground }" />

    <!-- System badge floats top-left when no art is cached. Hidden once a
         thumbnail loads so we don't double-label. -->
    <span
      v-if="game.system && !game.hasThumbnail"
      class="absolute left-2 top-2 rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85"
    >
      {{ game.system }}
    </span>

    <img
      v-if="game.hasThumbnail"
      :src="thumbnailUrl"
      :alt="game.displayName"
      class="absolute inset-0 size-full object-cover"
      loading="lazy"
      decoding="async"
    />

    <!-- Bottom overlay with title + playtime. -->
    <div
      class="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-black/85 via-black/60 to-transparent px-4 pb-2.5 pt-6 text-white"
    >
      <span class="line-clamp-2 text-sm font-semibold leading-tight">
        {{ game.displayName }}
      </span>
      <span
        class="flex items-center justify-between gap-2 text-[11px] text-white/80"
      >
        <span class="font-mono">{{ formatDuration(game.totalSeconds) }}</span>
        <span v-if="game.lastPlayedAt" class="truncate">
          {{ formatRelativeIso(game.lastPlayedAt) }}
        </span>
      </span>
    </div>
  </NuxtLink>
</template>
