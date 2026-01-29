<template>
  <div class="container">
    <div class="row between">
      <CircleIconButton icon="i" @click="showInfo = true" />
      <CircleIconButton icon="?" @click="goRules" />
    </div>

    <div style="height: 12px;"></div>

    <div class="spacer"></div>

    <div class="row center" style="flex-direction: column;">
      <GameLogo />
      <div style="height: 16px;"></div>
      <h1 class="section-title">Connect 4</h1>
      <p class="subtitle">Jouez en temps reel avec un ami</p>
    </div>

    <div class="spacer"></div>

    <SoftButton label="Creer un salon prive" @click="openCreate" />
    <div style="height: 14px;"></div>
    <SoftButton label="Rejoindre un salon" :filled="false" @click="openJoin(false)" />
    <div style="height: 12px;"></div>
    <SoftButton label="Observer un salon" :filled="false" @click="openJoin(true)" />
    <div style="height: 12px;"></div>

    <p class="small center muted">Serveur: {{ game.state.serverUrl }}</p>
  </div>

  <ModalDialog v-model="showInfo">
    <template #title>Infos</template>
    <p class="small">
      Parties privees en temps reel. Utilise un code pour rejoindre.
    </p>
    <template #actions>
      <SoftButton label="OK" @click="showInfo = false" />
    </template>
  </ModalDialog>

  <ModalDialog v-model="showNameDialog">
    <template #title>Ton nom</template>
    <input v-model.trim="createName" class="input" placeholder="Ton nom" />
    <template #actions>
      <SoftButton label="Annuler" :filled="false" @click="showNameDialog = false" />
      <SoftButton label="Continuer" @click="confirmCreate" />
    </template>
  </ModalDialog>

  <ModalDialog v-model="showJoinDialog">
    <template #title>{{ joinSpectator ? 'Observer un salon' : 'Rejoindre un salon' }}</template>
    <div style="display: grid; gap: 12px;">
      <input v-model.trim="joinCode" class="input" placeholder="Code du salon (ex: ABCDEF)" />
      <input v-model.trim="joinName" class="input" placeholder="Ton nom" />
    </div>
    <template #actions>
      <SoftButton label="Annuler" :filled="false" @click="showJoinDialog = false" />
      <SoftButton :label="joinSpectator ? 'Observer' : 'Rejoindre'" @click="confirmJoin" />
    </template>
  </ModalDialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import CircleIconButton from '../components/CircleIconButton.vue';
import SoftButton from '../components/SoftButton.vue';
import GameLogo from '../components/GameLogo.vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useGame } from '../composables/useGame';

const router = useRouter();
const route = useRoute();
const game = useGame();

const showInfo = ref(false);
const showNameDialog = ref(false);
const showJoinDialog = ref(false);
const joinSpectator = ref(false);

const lastName = ref(localStorage.getItem('c4_last_name') || '');
const createName = ref(lastName.value);
const joinName = ref(lastName.value);
const joinCode = ref('');

const goRules = () => {
  router.push('/rules');
};

const openCreate = () => {
  createName.value = lastName.value;
  showNameDialog.value = true;
};

const normalizeRoomCode = (code: string): string => {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
};

const openJoin = (spectator: boolean): void => {
  joinSpectator.value = spectator;
  joinCode.value = '';
  joinName.value = lastName.value;
  showJoinDialog.value = true;
};

const openJoinWithCode = (code: string, spectator: boolean): void => {
  joinSpectator.value = spectator;
  joinCode.value = normalizeRoomCode(code);
  joinName.value = lastName.value;
  showJoinDialog.value = true;
};

const consumeShareParams = (): void => {
  const codeParam = route.query.code;
  if (typeof codeParam !== 'string' || !codeParam.trim()) {
    return;
  }
  const spectatorParam = route.query.spectator;
  const spectator = spectatorParam === '1' || spectatorParam === 'true';
  if (showJoinDialog.value) {
    joinSpectator.value = spectator;
    joinCode.value = normalizeRoomCode(codeParam);
  } else {
    openJoinWithCode(codeParam, spectator);
  }
  const nextQuery = { ...route.query };
  delete nextQuery.code;
  delete nextQuery.spectator;
  router.replace({ path: route.path, query: nextQuery });
};

const persistName = (name: string): void => {
  if (!name) return;
  lastName.value = name;
  localStorage.setItem('c4_last_name', name);
};

const confirmCreate = async (): Promise<void> => {
  if (!createName.value) {
    return;
  }
  const finalName = createName.value.trim();
  createName.value = finalName;
  persistName(finalName);
  showNameDialog.value = false;
  game.leaveRoom();
  router.push('/game');
  await game.createRoom(finalName);
};

const confirmJoin = async (): Promise<void> => {
  if (!joinCode.value || !joinName.value) {
    return;
  }
  const finalName = joinName.value.trim();
  joinName.value = finalName;
  persistName(finalName);
  showJoinDialog.value = false;
  game.leaveRoom();
  router.push('/game');
  await game.joinRoom(joinCode.value, finalName, joinSpectator.value);
};

onMounted(() => {
  consumeShareParams();
});

watch(
  () => route.query.code,
  () => {
    consumeShareParams();
  },
);
</script>
