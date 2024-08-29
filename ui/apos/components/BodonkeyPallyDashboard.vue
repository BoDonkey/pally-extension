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
            <iframe src="http://localhost:4002" width="100%" height="800px"></iframe>
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
      pallyPorts: null
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
    // Retrieve pallyPorts from the global data added by ApostropheCMS
    this.pallyPort = window.apos?.pallyPort;

    // Log to verify that pallyPorts are available
    console.log('Pally Ports:', this.pallyPort);
  }
};
</script>