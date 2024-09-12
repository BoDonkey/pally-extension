const _ = require('lodash');
const pa11y = require('pa11y');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    label: 'pally-extension',
    alias: 'pallyExtension'
  },
  async init(self) {
    self.addManagerModal();
    self.addToAdminBar();
    await self.ensurePa11yCollection();
    await self.ensurePa11yIndexes();
  },
  methods(self) {
    return {
      addManagerModal() {
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
      },
      async ensurePa11yCollection() {
        self.resultsCollection = await self.apos.db.createCollection('pa11yResults').catch(() => {
          // If it already exists, just use it
          self.resultsCollection = self.apos.db.collection('pa11yResults');
        });
      },
      async ensurePa11yIndexes() {
        if (!self.resultsCollection) {
          throw new Error('Pa11y collection not initialized');
        }
        await self.resultsCollection.createIndex({ date: 1 });
        await self.resultsCollection.createIndex({ task: 1 });
      },
    };
  },
  apiRoutes(self) {
    return {
      post: {
        // Route to run a new Pa11y scan
        async scan(req) {
          const { url, ruleset = 'WCAG2AA' } = req.body;
          console.log('Scanning:', url, 'with ruleset:', ruleset);
          try {
            const results = await pa11y(url, { standard: ruleset });
            const resultData = {
              _id: uuidv4(),
              url,
              ruleset,
              date: new Date(),
              errorCount: results.issues.filter(issue => issue.type === 'error').length,
              warningCount: results.issues.filter(issue => issue.type === 'warning').length,
              noticeCount: results.issues.filter(issue => issue.type === 'notice').length,
              results: results
            };

            // Insert the scan results into the MongoDB collection
            try {
              await self.resultsCollection.insertOne(resultData);
            } catch (error) {
              console.error('Insert failed:', error);
            }
            return {
              resultData
            };
          } catch (err) {
            throw new Error(`Failed to run Pa11y scan: ${err.message}`);
          }
        }
      },
      get: {
        // Route to fetch historical Pa11y results
        async history(req) {
          const results = await self.apos.db.collection('pa11yResults').find().sort({ date: -1 }).toArray();
          console.log('History Results:', results);
          return {
            success: true,
            data: results
          };
        }
      },
      delete: {
        async clearHistory(req) {
          try {
            // Remove all documents from the collection
            const result = await self.apos.db.collection('pa11yResults').deleteMany({});
            // Return the count of deleted documents
            return {
              success: true,
              message: `${result.deletedCount} records deleted`
            };
          } catch (err) {
            console.error('Error clearing history:', err);
            return {
              success: false,
              error: err.message
            };
          }
        }
      }
    }
  }
};
