<template>
  <div class="container">
    <CircleIconButton icon="<" @click="goBack" />
    <div style="height: 18px;"></div>
    <h1 class="section-title">Regles du jeu</h1>
    <div style="height: 20px;"></div>

    <RuleCard
      title="Gagner"
      description="Aligne 4 pions (horizontale, verticale ou diagonale)."
      icon="4"
      icon-color="var(--accent-yellow)"
    />
    <div style="height: 14px;"></div>
    <RuleCard
      title="Gravite"
      description="Chaque pion tombe dans la colonne choisie."
      icon="↓"
      icon-color="var(--accent-blue)"
    />
    <div style="height: 14px;"></div>
    <RuleCard
      title="Match nul"
      description="Grille pleine sans alignement de 4."
      icon="="
      icon-color="var(--accent-orange)"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import CircleIconButton from '../components/CircleIconButton.vue';
import RuleCard from '../components/RuleCard.vue';

const router = useRouter();

const goBack = (): void => {
  router.back();
};
</script>
