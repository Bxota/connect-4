<template>
  <div class="board" @mouseleave="hoveredColumn = null">
    <div
      v-for="cell in flatBoard"
      :key="`${cell.row}-${cell.col}`"
      class="board-cell"
      :class="{ hovered: interactive && hoveredColumn === cell.col }"
      @click="handleDrop(cell.col)"
      @mouseenter="handleHover(cell.col)"
    >
      <div
        class="disc-piece"
        :class="discClasses(cell.row, cell.col, cell.value)"
        :key="discKey(cell.row, cell.col)"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

type CellCoord = { row: number; col: number };

type LastMove = {
  row: number;
  col: number;
  symbol: string;
};

const props = withDefaults(
  defineProps<{
    board: string[][];
    lastMove?: LastMove | null;
    winningCells?: CellCoord[];
    interactive?: boolean;
  }>(),
  {
    lastMove: null,
    winningCells: () => [],
    interactive: true,
  },
);

const emit = defineEmits<{
  (event: 'drop', column: number): void;
}>();

const hoveredColumn = ref<number | null>(null);
const dropToken = ref(0);

const flatBoard = computed(() => {
  const flattened: Array<{ row: number; col: number; value: string }> = [];
  props.board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      flattened.push({ row: rowIndex, col: colIndex, value });
    });
  });
  return flattened;
});

const winningSet = computed(() => {
  const entries = props.winningCells ?? [];
  return new Set(entries.map((cell) => `${cell.row}-${cell.col}`));
});

const isLastMove = (row: number, col: number): boolean => {
  return Boolean(props.lastMove && props.lastMove.row === row && props.lastMove.col === col);
};

const discKey = (row: number, col: number): string => {
  if (isLastMove(row, col)) {
    return `last-${row}-${col}-${dropToken.value}`;
  }
  return `cell-${row}-${col}`;
};

const discClasses = (row: number, col: number, value: string): string[] => {
  const classes: string[] = [];
  if (value === 'R') classes.push('red');
  if (value === 'Y') classes.push('yellow');
  if (isLastMove(row, col) && value !== '') classes.push('drop');
  if (winningSet.value.has(`${row}-${col}`)) classes.push('win');
  return classes;
};

const handleHover = (column: number): void => {
  if (!props.interactive) {
    hoveredColumn.value = null;
    return;
  }
  hoveredColumn.value = column;
};

const handleDrop = (column: number): void => {
  if (!props.interactive) {
    return;
  }
  emit('drop', column);
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

let dropAudio: HTMLAudioElement | null = null;

const ensureDropAudio = (): HTMLAudioElement | null => {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    return null;
  }
  if (!dropAudio) {
    dropAudio = new Audio('/sfx/token.mp3');
    dropAudio.preload = 'auto';
  }
  return dropAudio;
};

const playDropSound = (): void => {
  if (prefersReducedMotion()) {
    return;
  }
  const audio = ensureDropAudio();
  if (!audio) {
    return;
  }
  const playback = audio.cloneNode(true) as HTMLAudioElement;
  playback.play().catch(() => null);
};

watch(
  () => props.lastMove,
  (next, prev) => {
    if (!next) {
      return;
    }
    if (prev && prev.row === next.row && prev.col === next.col && prev.symbol === next.symbol) {
      return;
    }
    dropToken.value = Date.now();
    playDropSound();
  },
  { deep: true },
);
</script>
