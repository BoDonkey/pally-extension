const _ = require('lodash');
const { exec } = require('child_process');
const path = require('path');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    label: 'pally-extension',
    port: process.env.WEBSERVICE_PORT || 3001,
  },
  init(self) {
    const port = self.options.port;
    // Start the pa11y-dashboard server
    const dashboardPath = path.resolve(__dirname, '../../pa11y-dashboard/index.js');
    const dashboardProcess = exec(`WEBSERVICE_PORT=${port} node ${dashboardPath}`);


    dashboardProcess.stdout.on('data', (data) => {
      console.log(`pa11y-dashboard: ${data}`);
    });

    dashboardProcess.stderr.on('data', (data) => {
      console.error(`pa11y-dashboard error: ${data}`);
    });
    self.addToAdminBar();
    self.addManagerModal();
  },
  methods(self) {
    return {
      addManagerModal() {
        console.log('Adding manager');
        self.apos.modal.add(
          `pally-dashboard`,
          self.getComponentName('managerModal', 'BodonkeyPallyDashboard'),
          { moduleName: 'BodonkeyPallyDashboard' }
        );
      },
      addToAdminBar() {
        self.apos.adminBar.add(
          'pally-dashboard',
          'pally-dashboard'
        );
      }
    }
  }
};
