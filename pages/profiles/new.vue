<script setup lang="ts">
const name = ref("");
const notes = ref("");
const error = ref<string | null>(null);
const submitting = ref(false);

async function submit() {
  if (!name.value.trim()) {
    error.value = "Name is required";
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const res = await $fetch<{ profile: { name: string } }>("/api/profiles", {
      method: "POST",
      body: { name: name.value.trim(), notes: notes.value.trim() || undefined },
    });
    await navigateTo(`/profiles/${encodeURIComponent(res.profile.name)}`);
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage ?? (e as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-bold">New profile</h1>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div>
        <label class="label" for="name">Name</label>
        <input
          id="name"
          v-model="name"
          class="input"
          placeholder="Pokemon Emerald"
          autocomplete="off"
          autocapitalize="words"
        />
      </div>
      <div>
        <label class="label" for="notes">Notes (optional)</label>
        <textarea
          id="notes"
          v-model="notes"
          rows="3"
          class="input"
          placeholder="e.g. RG35XX <-> RetroArch on PC"
        />
      </div>
      <p v-if="error" class="text-danger">{{ error }}</p>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary flex-1" :disabled="submitting">
          <Spinner v-if="submitting" size="sm" />
          <span>{{ submitting ? "Creating…" : "Create" }}</span>
        </button>
        <NuxtLink to="/" class="btn-secondary">Cancel</NuxtLink>
      </div>
    </form>
  </div>
</template>
