const _ = require('lodash');
const pa11y = require('pa11y');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');

const scanProgress = new Map();

module.exports = {
  extend: '@apostrophecms/doc-type',
  options: {
    label: 'pally-extension',
    alias: 'pallyExtension',
    scanDefaults: {
      maxPages: 500
    }
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
          return self.apos.db.collection('pa11yResults');
        });
      },
      async ensurePa11yIndexes() {
        if (!self.resultsCollection) {
          throw new Error('Pa11y collection not initialized');
        }
        await self.resultsCollection.createIndex({ date: 1 });
        await self.resultsCollection.createIndex({ task: 1 });
      },
      async parseSitemap(sitemapUrl, progressCallback) {
        try {
          progressCallback(`Fetching sitemap: ${sitemapUrl}`);
          const response = await axios.get(sitemapUrl, { timeout: 10000 });
          const parser = new XMLParser();
          const result = parser.parse(response.data);

          if (result.urlset && result.urlset.url) {
            progressCallback(`Found ${result.urlset.url.length} URLs in sitemap`);
            return result.urlset.url.map(entry => entry.loc);
          } else if (result.sitemapindex && result.sitemapindex.sitemap) {
            progressCallback('Found sitemap index, parsing sub-sitemaps...');
            const subSitemapUrls = result.sitemapindex.sitemap.map(entry => entry.loc);
            let allUrls = [];
            for (const subSitemapUrl of subSitemapUrls) {
              const subUrls = await self.parseSitemap(subSitemapUrl, progressCallback);
              allUrls = allUrls.concat(subUrls);
            }
            return allUrls;
          }
          progressCallback('No valid sitemap structure found');
          return [];
        } catch (error) {
          progressCallback(`Error parsing sitemap ${sitemapUrl}: ${error.message}`);
          return [];
        }
      },
      async crawlWebsite(startUrl, maxPages, progressCallback) {
        progressCallback(`Starting crawl of ${startUrl}`);
        const sitemapUrl = new URL('/sitemap.xml', startUrl).toString();
        let pages = [];

        try {
          pages = await self.parseSitemap(sitemapUrl, progressCallback);
          progressCallback(`Found ${pages.length} pages in sitemap`);
        } catch (error) {
          progressCallback(`Error parsing sitemap: ${error.message}`);
        }

        if (pages.length === 0) {
          progressCallback('No sitemap found or empty sitemap. Falling back to link crawling.');
          const visited = new Set();
          const toVisit = [startUrl];

          while (toVisit.length > 0 && pages.length < maxPages) {
            const url = toVisit.pop();
            if (visited.has(url)) continue;

            visited.add(url);
            pages.push(url);
            progressCallback(`Crawled ${pages.length} pages...`);

            try {
              const response = await axios.get(url, { timeout: 10000 });
              const $ = cheerio.load(response.data);

              $('a').each((i, link) => {
                const href = $(link).attr('href');
                if (href && href.startsWith('/') && !visited.has(href)) {
                  toVisit.push(new URL(href, startUrl).toString());
                }
              });
            } catch (error) {
              progressCallback(`Error crawling ${url}: ${error.message}`);
            }
          }
        }

        progressCallback(`Crawling complete. Found ${pages.length} pages`);
        return pages.slice(0, maxPages);
      },
      async scanSinglePage(url, ruleset) {
        const includeWarnings = (typeof self.options.includeWarnings !== 'undefined') ? self.options.includeWarnings : true;
        const includeNotices = (typeof self.options.includeNotices !== 'undefined') ? self.options.includeNotices : true;

        try {
          const pageResult = await pa11y(url, {
            standard: ruleset,
            timeout: 30000,
            includeWarnings,
            includeNotices
          });
          return {
            url: url,
            errorCount: pageResult.issues.filter(issue => issue.type === 'error').length,
            warningCount: pageResult.issues.filter(issue => issue.type === 'warning').length,
            noticeCount: pageResult.issues.filter(issue => issue.type === 'notice').length,
            issues: pageResult.issues
          };
        } catch (error) {
          console.error(`Error scanning ${url}: ${error.message}`);
          return null;
        }
      },
      async scanWebsite(scanId, startUrl, ruleset, fullScan, maxPages, progressCallback) {
        progressCallback(`Starting ${fullScan ? 'full' : 'single page'} scan of ${startUrl}`);
        const pages = fullScan ? await self.crawlWebsite(startUrl, maxPages, progressCallback) : [startUrl];
        const results = [];
        let scannedCount = 0;

        // Retrieve the mutable progress object
        const progress = scanProgress.get(scanId);
        progress.totalPages = pages.length;

        for (const page of pages) {
          // Check if the scan has been cancelled
          if (progress.cancelled) {
            progressCallback(`Scan ${scanId} has been cancelled.`);
            break; // Exit the loop to stop scanning
          }

          progressCallback(`Scanning page ${scannedCount + 1} of ${pages.length}: ${page}`);

          try {
            const pageResult = await self.scanSinglePage(page, ruleset);
            if (pageResult) {
              results.push(pageResult);
            }
          } catch (error) {
            console.error(`Error scanning page ${page}: ${error.message}`);
          }

          scannedCount++;
          progress.scannedCount = scannedCount;
          progress.currentPage = page;
        }

        progressCallback(`Scan complete. Scanned ${results.length} pages successfully`);
        scanProgress.delete(scanId);
        return results;
      }
    }
  },
  apiRoutes(self) {
    return {
      post: {
        async scan(req) {
          const { url, ruleset = 'WCAG2AA', fullScan = false } = req.body;
          const maxPages = self.options.maxPages || self.options.scanDefaults.maxPages;
          console.log(`Starting scan: URL=${url}, Ruleset=${ruleset}, FullScan=${fullScan}, MaxPages=${maxPages}`);

          const scanId = uuidv4();
          // Initialize a mutable progress object
          const progress = {
            scannedCount: 0,
            totalPages: 0,
            currentPage: '',
            cancelled: false
          };
          scanProgress.set(scanId, progress);
          // Start the scan process asynchronously
          self.scanWebsite(scanId, url, ruleset, fullScan, maxPages, (message) => {
            console.log(message);
          }).then(async (results) => {
            const resultData = {
              _id: scanId,
              startUrl: url,
              ruleset,
              date: new Date(),
              fullScan,
              pagesScanned: results.length,
              totalErrors: results.reduce((sum, page) => sum + page.errorCount, 0),
              totalWarnings: results.reduce((sum, page) => sum + page.warningCount, 0),
              totalNotices: results.reduce((sum, page) => sum + page.noticeCount, 0),
              results: results
            };

            try {
              await self.resultsCollection.insertOne(resultData);
            } catch (error) {
              console.error('Insert failed:', error);
            }
          }).catch((err) => {
            console.error(`Scan failed: ${err.message}`);
            scanProgress.delete(scanId);
          });

          return {
            success: true,
            scanId: scanId
          };
        },
        async cancelScan(req) {
          const { scanId } = req.body;
          if (!scanId) {
            return {
              success: false,
              message: 'Scan ID is required'
            };
          }
          const progress = scanProgress.get(scanId);
          if (progress) {
            // Set the cancelled flag to true
            progress.cancelled = true;
            return {
              success: true,
              message: `Scan ${scanId} has been cancelled`
            };
          } else {
            return {
              success: false,
              message: 'Scan not found or already completed'
            };
          }
        }
      },
      get: {
        async history(req) {
          const results = await self.apos.db.collection('pa11yResults').find().sort({ date: -1 }).toArray();
          return {
            success: true,
            data: results
          };
        },
        async getScanProgress(req) {
          const { scanId } = req.query;
          const progress = scanProgress.get(scanId);
          if (progress) {
            return {
              success: true,
              data: {
                status: progress.cancelled ? 'cancelled' : 'in-progress',
                ...progress
              }
            };
          } else {
            // Check if scan is completed
            const result = await self.resultsCollection.findOne({ _id: scanId });
            if (result) {
              return {
                success: true,
                data: {
                  status: 'completed',
                  results: result
                }
              };
            } else {
              return {
                success: false,
                message: 'Scan not found'
              };
            }
          }
        }
      },
      delete: {
        async clearHistory(req) {
          try {
            const result = await self.apos.db.collection('pa11yResults').deleteMany({});
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
        },
        async deleteHistoryItem(req) {
          const { id } = req.body;
          try {
            const result = await self.apos.db.collection('pa11yResults').deleteOne({ _id: id });
            return {
              success: true,
              message: `${result.deletedCount} record deleted`
            };
          } catch (err) {
            console.error('Error deleting history item:', err);
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