<template>
  <div class="app-background">
    <div class="orb orb--one"></div>
    <div class="orb orb--two"></div>
    <div class="orb orb--three"></div>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>
