<script setup lang="ts">
/**
 * Accessible single-select dropdown following the WAI-ARIA APG
 * "Select-Only Combobox" pattern: a combobox trigger plus a listbox popup,
 * with focus kept on the trigger and the active option tracked via
 * aria-activedescendant. Fully keyboard-operable and dark-themed with
 * full-width option highlighting (which native <select> popups can't do).
 */
interface Option {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: Option[];
    ariaLabel?: string;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  { ariaLabel: undefined, disabled: false, placeholder: "Select…" },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const baseId = useId();
const listboxId = `${baseId}-listbox`;
const optionId = (i: number) => `${baseId}-opt-${i}`;

const rootEl = ref<HTMLElement | null>(null);
const buttonEl = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const activeIndex = ref(-1);

const selectedIndex = computed(() => props.options.findIndex((o) => o.value === props.modelValue));
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? props.placeholder);
const hasValue = computed(() => selectedIndex.value >= 0 && props.modelValue !== "");

function openMenu() {
  if (props.disabled) return;
  open.value = true;
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0;
}

function closeMenu(refocus = true) {
  open.value = false;
  if (refocus) buttonEl.value?.focus();
}

function selectIndex(i: number) {
  const opt = props.options[i];
  if (!opt) return;
  emit("update:modelValue", opt.value);
  closeMenu();
}

function moveActive(delta: number) {
  const n = props.options.length;
  if (n === 0) return;
  const next = Math.min(Math.max((activeIndex.value < 0 ? 0 : activeIndex.value) + delta, 0), n - 1);
  activeIndex.value = next;
}

// Typeahead: jump to the next option whose label starts with the typed prefix.
let typeBuffer = "";
let typeTimer: ReturnType<typeof setTimeout> | null = null;
function typeahead(char: string) {
  typeBuffer += char.toLowerCase();
  if (typeTimer) clearTimeout(typeTimer);
  typeTimer = setTimeout(() => (typeBuffer = ""), 500);
  const match = props.options.findIndex((o) => o.label.toLowerCase().startsWith(typeBuffer));
  if (match >= 0) {
    activeIndex.value = match;
    if (!open.value) selectIndex(match);
  }
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!open.value) openMenu();
      else moveActive(1);
      break;
    case "ArrowUp":
      e.preventDefault();
      if (!open.value) openMenu();
      else moveActive(-1);
      break;
    case "Home":
      if (open.value) {
        e.preventDefault();
        activeIndex.value = 0;
      }
      break;
    case "End":
      if (open.value) {
        e.preventDefault();
        activeIndex.value = props.options.length - 1;
      }
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      if (open.value) selectIndex(activeIndex.value);
      else openMenu();
      break;
    case "Escape":
      if (open.value) {
        e.preventDefault();
        closeMenu();
      }
      break;
    case "Tab":
      if (open.value) closeMenu(false);
      break;
    default:
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeahead(e.key);
  }
}

function onButtonClick() {
  if (props.disabled) return;
  if (open.value) closeMenu();
  else openMenu();
}

// Keep the active option scrolled into view while navigating.
watch(activeIndex, async (i) => {
  if (!open.value || i < 0) return;
  await nextTick();
  document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" });
});

function onDocPointer(e: Event) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) closeMenu(false);
}
onMounted(() => document.addEventListener("pointerdown", onDocPointer));
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointer);
  if (typeTimer) clearTimeout(typeTimer);
});
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      ref="buttonEl"
      type="button"
      role="combobox"
      class="input flex items-center justify-between gap-2 text-left"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      :aria-activedescendant="open && activeIndex >= 0 ? optionId(activeIndex) : undefined"
      :disabled="disabled"
      @click="onButtonClick"
      @keydown="onKeydown"
    >
      <span class="truncate" :class="hasValue ? '' : 'text-fg-dim'">{{ selectedLabel }}</span>
      <span aria-hidden="true" class="shrink-0 text-fg-dim">▾</span>
    </button>

    <ul
      v-show="open"
      :id="listboxId"
      role="listbox"
      :aria-label="ariaLabel"
      class="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-surface py-1 shadow-lg"
      style="border-color: var(--color-border)"
    >
      <li
        v-for="(o, i) in options"
        :id="optionId(i)"
        :key="o.value"
        role="option"
        :aria-selected="o.value === modelValue"
        class="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-base"
        :class="i === activeIndex ? 'bg-surface-2 text-fg' : 'text-fg'"
        @click="selectIndex(i)"
        @pointermove="activeIndex = i"
      >
        <span class="truncate">{{ o.label }}</span>
        <span v-if="o.value === modelValue" aria-hidden="true" class="shrink-0 text-accent">✓</span>
      </li>
    </ul>
  </div>
</template>
