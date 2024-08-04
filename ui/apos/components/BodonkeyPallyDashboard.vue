<template>

  <AposModal
      :modal="modal"
      modal-title="Pa11y Dashboard"
      @esc="cancel"
      @show-modal="modal.showModal = true"
    >
    <template #secondaryControls>
      <AposButton
          type="default"
          label="apostrophe:exit"
          @click="cancel"
        />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div>
            <h1>Donkey Pally Dashboard</h1>
            <p>Donkey Pally Dashboard is a dashboard for Donkey Pally.</p>
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  name: 'BodonkeyPallyDashboard',
  data() {
    return {
      modal: {
        active: false,
        triggerFocusRefresh: 0,
        type: 'slide',
        showModal: false,
        width: 'full',
      },
    }
  },
  methods: {
    cancel() {
      this.modal.showModal = false;
    }
  },
  async mounted() {
    this.modal.active = true;
    this.modal.triggerFocusRefresh++;
  }
};
</script>