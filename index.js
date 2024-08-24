const _ = require('lodash');
const { exec } = require('child_process');
const path = require('path');
const net = require('net');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    label: 'pally-extension',
    startingWebservicePort: parseInt(process.env.STARTING_WEBSERVICE_PORT) || 3001,
    startingPort: parseInt(process.env.STARTING_PORT) || 4001,
    portIncrementStep: 2 // Adjust this as needed
  },
  init(self) {
    // Initialize global port tracking if not already present
    if (!self.apos.pallyPorts) {
      self.apos.pallyPorts = {
        currentWebservicePort: self.options.startingWebservicePort,
        currentPort: self.options.startingPort
      };
    }

    // Find available ports for this site instance
    findAvailablePorts(self.apos.pallyPorts.currentWebservicePort, self.apos.pallyPorts.currentPort, self.options.portIncrementStep)
      .then(({ webservicePort, port }) => {
        // Start the pa11y-dashboard server with the assigned ports
        const dashboardPath = path.resolve(__dirname, '../../pa11y-dashboard/index.js');
        const dashboardProcess = exec(`WEBSERVICE_PORT=${webservicePort} PORT=${port} node ${dashboardPath}`);

        dashboardProcess.stdout.on('data', (data) => {
          console.log(`pa11y-dashboard (port ${port}): ${data}`);
        });

        dashboardProcess.stderr.on('data', (data) => {
          console.error(`pa11y-dashboard error (port ${port}): ${data}`);
        });

        // Increment the ports for the next site
        self.apos.pallyPorts.currentWebservicePort = webservicePort + self.options.portIncrementStep;
        self.apos.pallyPorts.currentPort = port + self.options.portIncrementStep;

        self.addToAdminBar();
        self.addManagerModal();
      })
      .catch((error) => {
        console.error(`Error finding available ports: ${error}`);
      });
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
    };
  }
};

// Utility function to check if a port is available
function checkPortInUse(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        reject(err); // Unexpected error
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false); // Port is available
    });

    server.listen(port);
  });
}

// Function to find the next available ports
async function findAvailablePorts(startingWebservicePort, startingPort, incrementStep) {
  let webservicePort = startingWebservicePort;
  let port = startingPort;

  // Keep checking and incrementing until both ports are available
  while (await checkPortInUse(webservicePort) || await checkPortInUse(port)) {
    webservicePort += incrementStep;
    port += incrementStep;
  }

  return { webservicePort, port };
}
