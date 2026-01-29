<template>
  <button
    class="soft-button"
    :class="{ 'soft-button--outline': !filled }"
    type="button"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot name="leading"></slot>
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    filled?: boolean;
    disabled?: boolean;
  }>(),
  {
    filled: true,
    disabled: false,
  },
);

defineEmits<{
  (event: 'click'): void;
}>();
</script>
