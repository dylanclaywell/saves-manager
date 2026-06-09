<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg";
    label?: string;
  }>(),
  { size: "md", label: "Loading" },
);

const sizeClass = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-4 w-4 border-2";
    case "lg":
      return "h-7 w-7 border-[3px]";
    default:
      return "h-5 w-5 border-2";
  }
});
</script>

<template>
  <span
    class="inline-block animate-spin rounded-full border-current border-t-transparent align-[-2px]"
    :class="sizeClass"
    role="status"
    :aria-label="label"
  />
</template>
