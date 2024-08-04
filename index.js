const _ = require('lodash');
const { exec } = require('child_process');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    label: 'pally-extension',
  },
  init(self) {
    // Start the pa11y-dashboard server
    const dashboardProcess = exec('WEBSERVICE_PORT=3001 node ../pa11y-dashboard/index.js');

    dashboardProcess.stdout.on('data', (data) => {
      console.log(`pa11y-dashboard: ${data}`);
    });

    dashboardProcess.stderr.on('data', (data) => {
      console.error(`pa11y-dashboard error: ${data}`);
    });
    self.addToAdminBar();
    self.addManagerModal();
    self.enableBrowserData();

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
  },
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const browserOptions = _super(req);
        _.defaults(browserOptions.components, {
          managerModal: self.getComponentName('managerModal', 'BodonkeyPallyDashboard')
        });
      }
    }
  }
};
