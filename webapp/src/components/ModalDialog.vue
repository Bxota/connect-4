<template>
  <transition name="fade">
    <div v-if="modelValue" class="modal-backdrop" @click.self="close">
      <div class="modal">
        <p class="modal-title">
          <slot name="title"></slot>
        </p>
        <div>
          <slot></slot>
        </div>
        <div class="modal-actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const close = (): void => {
  emit('update:modelValue', false);
};
</script>
