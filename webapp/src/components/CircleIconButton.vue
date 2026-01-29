<template>
  <button class="circle-button" type="button" @click="$emit('click')">
    <span aria-hidden="true">{{ icon }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
}>();

defineEmits<{
  (event: 'click'): void;
}>();
</script>
