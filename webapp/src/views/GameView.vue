<template>
  <div class="container game-screen" :class="{ 'screen-shake': shakeActive }">
    <canvas v-show="confettiVisible" ref="confettiCanvas" class="confetti-layer"></canvas>
    <div class="row between">
      <CircleIconButton icon="<" @click="goBack" />
      <span style="font-weight: 700; font-size: 14px;">Salon {{ roomCode }}</span>
      <span style="width: 40px;"></span>
    </div>

    <div style="height: 12px;"></div>

    <div class="row center" style="gap: 10px; flex-wrap: wrap;">
      <button class="muted small" style="background: none; border: none; cursor: pointer;" @click="copyCode">
        Copier le code
      </button>
      <button class="muted small" style="background: none; border: none; cursor: pointer;" @click="copyShareLink">
        Copier le lien
      </button>
    </div>

    <div style="height: 16px;"></div>

    <div class="row" style="gap: 12px;">
      <PlayerStatusCard
        :label="playerLabelRed"
        symbol="●"
        :connected="isSpectator ? isPlayerConnected('R') : youConnected"
        highlight="var(--accent-red)"
      />
      <PlayerStatusCard
        :label="playerLabelYellow"
        symbol="●"
        :connected="isSpectator ? isPlayerConnected('Y') : opponentConnected"
        highlight="var(--accent-yellow)"
      />
    </div>

    <div style="height: 20px;"></div>

    <h2 class="section-title" style="font-size: 18px; text-align: center;">{{ statusText }}</h2>

    <p v-if="game.state.errorMessage" class="small center" style="color: var(--accent-orange); margin-top: 8px;">
      {{ game.state.errorMessage }}
    </p>

    <div style="height: 20px;"></div>

    <ConnectBoard
      :board="board"
      :last-move="state?.lastMove || null"
      :winning-cells="state?.winningCells || []"
      :interactive="boardInteractive"
      @drop="handleDrop"
    />

    <div style="height: 18px;"></div>

    <SoftButton
      v-if="showRematch"
      label="Rejouer"
      @click="game.requestRematch"
    />
    <div v-if="showRematch" style="height: 12px;"></div>

    <SoftButton
      v-if="showReconnect"
      label="Reconnecter"
      @click="game.reconnect"
    />

    <SoftButton
      v-if="game.state.roomClosed"
      label="Retour accueil"
      @click="goBack"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, onBeforeUnmount, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import CircleIconButton from '../components/CircleIconButton.vue';
import PlayerStatusCard from '../components/PlayerStatusCard.vue';
import SoftButton from '../components/SoftButton.vue';
import ConnectBoard from '../components/ConnectBoard.vue';
import { useGame } from '../composables/useGame';

const router = useRouter();
const route = useRoute();
const game = useGame();
const shakeActive = ref(false);
const confettiVisible = ref(false);
const confettiCanvas = ref<HTMLCanvasElement | null>(null);
let confettiFrame: number | null = null;
let confettiTimeout: number | null = null;
let shakeTimeout: number | null = null;

const roomCode = computed(() => game.state.roomCode || '----');
const state = computed(() => game.state.gameState);
const symbol = computed(() => game.state.symbol || 'R');
const opponentSymbol = computed(() => (symbol.value === 'R' ? 'Y' : 'R'));
const isSpectator = computed(() => game.isSpectator.value);
const board = computed(() => state.value?.board ?? Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => '')));

const isPlayerConnected = (playerSymbol: string): boolean => {
  return state.value?.players?.[playerSymbol]?.connected ?? false;
};

const playerName = (playerSymbol: string): string => {
  return state.value?.players?.[playerSymbol]?.name ?? '';
};

const youConnected = computed(() => isPlayerConnected(symbol.value) || game.isConnected.value);
const opponentConnected = computed(() => isPlayerConnected(opponentSymbol.value));

const playerLabelRed = computed(() => {
  if (isSpectator.value) {
    return playerName('R') || 'Rouge';
  }
  const name = playerName(symbol.value);
  return name ? `Toi - ${name}` : 'Toi';
});

const playerLabelYellow = computed(() => {
  if (isSpectator.value) {
    return playerName('Y') || 'Jaune';
  }
  const name = playerName(opponentSymbol.value);
  return name ? name : 'Adversaire';
});

const statusText = computed(() => {
  if (game.state.roomClosed) {
    return 'Salon ferme';
  }
  if (game.state.connectionStatus === 'connecting') {
    return 'Connexion en cours...';
  }
  if (game.state.connectionStatus === 'disconnected' && !state.value) {
    return 'Connexion perdue';
  }
  if (!state.value) {
    return 'En attente du serveur...';
  }
  switch (state.value.status) {
    case 'waiting':
      return isSpectator.value ? 'En attente de joueurs' : 'En attente d\'un adversaire';
    case 'paused':
      return isSpectator.value ? 'Joueur deconnecte' : 'Adversaire deconnecte';
    case 'win':
      if (isSpectator.value || !state.value.winner) {
        return 'Partie terminee';
      }
      return state.value.winner === symbol.value ? 'Victoire !' : 'Defaite';
    case 'draw':
      return 'Match nul';
    case 'in_progress':
      if (isSpectator.value) {
        return 'Partie en cours';
      }
      return state.value.turn === symbol.value ? 'A ton tour' : 'Tour adverse';
    default:
      return 'En attente';
  }
});

const shareLink = computed(() => {
  if (!game.state.roomCode || typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}/game?code=${encodeURIComponent(game.state.roomCode)}`;
});

const bothPlayersConnected = computed(() => isPlayerConnected('R') && isPlayerConnected('Y'));
const showRematch = computed(() => {
  const status = state.value?.status ?? '';
  return ['win', 'draw'].includes(status) &&
    bothPlayersConnected.value && !game.state.roomClosed && !isSpectator.value;
});

const showReconnect = computed(() => {
  return game.state.connectionStatus !== 'connected' &&
    !game.state.roomClosed &&
    Boolean(game.state.roomCode);
});

const boardInteractive = computed(() => {
  if (isSpectator.value) return false;
  if (!state.value) return false;
  if (state.value.status !== 'in_progress') return false;
  return state.value.turn === symbol.value;
});

const goBack = (): void => {
  game.leaveRoom();
  router.push('/');
};

const copyCode = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(roomCode.value);
  } catch (error) {
    // no-op
  }
};

const copyShareLink = async (): Promise<void> => {
  if (!shareLink.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(shareLink.value);
  } catch (error) {
    // no-op
  }
};

const handleDrop = (column: number): void => {
  if (!state.value || isSpectator.value) {
    return;
  }
  if (state.value.status !== 'in_progress') {
    return;
  }
  if (state.value.turn !== symbol.value) {
    return;
  }
  game.sendMove(column);
};

const redirectToJoinIfNeeded = (): void => {
  if (game.state.roomCode) {
    return;
  }
  const codeParam = route.query.code;
  if (typeof codeParam !== 'string' || !codeParam.trim()) {
    return;
  }
  const spectatorParam = route.query.spectator;
  const spectator = spectatorParam === '1' || spectatorParam === 'true';
  const query: Record<string, string> = { code: codeParam };
  if (spectator) {
    query.spectator = '1';
  }
  router.replace({ path: '/', query });
};

onMounted(() => {
  redirectToJoinIfNeeded();
});

watch(
  () => route.query.code,
  () => {
    redirectToJoinIfNeeded();
  },
);

let lastStatus: string | null = state.value?.status ?? null;
let lastWinner = state.value?.winner ?? '';

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const triggerShake = (): void => {
  if (prefersReducedMotion()) {
    return;
  }
  if (shakeTimeout) {
    window.clearTimeout(shakeTimeout);
    shakeTimeout = null;
  }
  shakeActive.value = false;
  window.requestAnimationFrame(() => {
    shakeActive.value = true;
    shakeTimeout = window.setTimeout(() => {
      shakeActive.value = false;
      shakeTimeout = null;
    }, 320);
  });
};

type ConfettiParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
};

const createParticles = (count: number, width: number, height: number): ConfettiParticle[] => {
  const palette = [
    'rgba(255, 116, 116, 0.75)',
    'rgba(247, 206, 78, 0.75)',
    'rgba(255, 186, 125, 0.7)',
    'rgba(255, 241, 194, 0.6)',
    'rgba(255, 255, 255, 0.5)',
  ];
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: -height * 0.2 + Math.random() * height * 0.4,
    vx: -30 + Math.random() * 60,
    vy: 50 + Math.random() * 120,
    size: 3 + Math.random() * 4,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: -3 + Math.random() * 6,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));
};

const stopConfetti = (): void => {
  if (confettiFrame) {
    window.cancelAnimationFrame(confettiFrame);
    confettiFrame = null;
  }
  if (confettiTimeout) {
    window.clearTimeout(confettiTimeout);
    confettiTimeout = null;
  }
  const canvas = confettiCanvas.value;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
  confettiVisible.value = false;
};

const triggerConfetti = (): void => {
  if (prefersReducedMotion()) {
    return;
  }
  const canvas = confettiCanvas.value;
  if (!canvas || typeof window === 'undefined') {
    return;
  }
  stopConfetti();
  confettiVisible.value = true;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = createParticles(90, width, height);
  const gravity = 220;
  const durationMs = 1800;
  const fadeStartMs = 1200;
  const startTime = performance.now();
  let lastTime = startTime;

  const draw = (time: number): void => {
    const elapsed = time - startTime;
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    ctx.clearRect(0, 0, width, height);
    const fade = elapsed < fadeStartMs ? 1 : Math.max(0, 1 - (elapsed - fadeStartMs) / 600);
    ctx.globalAlpha = fade;

    for (const particle of particles) {
      particle.vy += gravity * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.rotation += particle.rotationSpeed * delta;

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size * 0.8, -particle.size * 0.5, particle.size * 1.6, particle.size);
      ctx.restore();
    }

    if (elapsed < durationMs) {
      confettiFrame = window.requestAnimationFrame(draw);
    } else {
      stopConfetti();
    }
  };

  confettiFrame = window.requestAnimationFrame(draw);
  confettiTimeout = window.setTimeout(stopConfetti, durationMs + 100);
};

watch(
  () => [state.value?.status, state.value?.winner],
  ([status, winner]) => {
    if (status === 'win' && winner && !isSpectator.value) {
      const shouldTrigger = status !== lastStatus || winner !== lastWinner;
      if (shouldTrigger) {
        if (winner === symbol.value) {
          triggerConfetti();
        } else {
          triggerShake();
        }
      }
    }
    if (status !== 'win') {
      stopConfetti();
    }
    lastStatus = status ?? null;
    lastWinner = winner ?? '';
  },
);

onBeforeUnmount(() => {
  stopConfetti();
  if (shakeTimeout) {
    window.clearTimeout(shakeTimeout);
  }
});
</script>
