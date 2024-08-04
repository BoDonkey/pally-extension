const { exec } = require('child_process');

module.exports = {
  extend: '@apostrophecms/page-type',
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
  }
};
