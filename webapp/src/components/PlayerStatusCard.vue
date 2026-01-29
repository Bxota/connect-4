<template>
  <div class="status-card">
    <div class="row">
      <span class="status-dot" :style="{ background: connected ? highlight : 'var(--text-muted)' }"></span>
      <span class="label">{{ label }}</span>
    </div>
    <span class="symbol" :style="{ color: highlight }">{{ symbol }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    symbol: string;
    connected?: boolean;
    highlight: string;
  }>(),
  {
    connected: false,
  },
);
</script>
