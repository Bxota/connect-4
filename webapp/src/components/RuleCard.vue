<template>
  <div class="rule-card">
    <div class="icon" :style="{ color: iconColor }">{{ icon }}</div>
    <div>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description: string;
    icon: string;
    iconColor?: string;
  }>(),
  {
    iconColor: 'var(--accent-blue)',
  },
);
</script>
