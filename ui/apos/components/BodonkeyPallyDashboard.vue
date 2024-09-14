<template>
  <AposModal :modal="modal" modal-title="Pa11y Scan Results" @esc="cancel" @no-modal="$emit('safe-close')"
    @show-modal="modal.showModal = true" @inactive="modal.active = false" @ready="ready">
    <template #secondaryControls>
      <AposButton ref="cancelButton" type="default" label="apostrophe:cancel" @click="cancel" />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div class="pa11y-scan-form">
            <h3>Pa11y Accessibility Scan</h3>
            <div class="form-group">
              <label for="ruleset">Choose Ruleset:</label>
              <select v-model="ruleset" id="ruleset" class="form-control">
                <option value="WCAG2A">WCAG2A</option>
                <option value="WCAG2AA">WCAG2AA</option>
                <option value="WCAG2AAA">WCAG2AAA</option>
                <option value="Section508">Section 508</option>
              </select>
            </div>
            <div class="form-group">
              <label for="scanUrl">URL to Scan:</label>
              <input v-model="scanUrl" id="scanUrl" class="form-control" placeholder="Enter URL to scan" />
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" v-model="fullScan" />
                Full Site Scan
              </label>
            </div>
            <AposButton label="Run Scan" @click="runScan" />
          </div>

          <div v-if="loading">
            Running scan...
            <div>{{ scanProgress }}</div>
          </div>
          <div v-if="error">{{ error }}</div>
          <div v-if="results">
            <h3>Scan Results for {{ results.startUrl }}</h3>
            <p>
              <span class="result-count">Pages Scanned: {{ results.pagesScanned }}</span>
              <span class="result-count error">Errors: {{ results.totalErrors }}</span>
              <span class="result-count warning">Warnings: {{ results.totalWarnings }}</span>
              <span class="result-count notice">Notices: {{ results.totalNotices }}</span>
            </p>
            <AposButton label="Download Results" @click="downloadResults" />

            <h4>Detailed Results:</h4>
            <div v-for="(page, pageIndex) in results.results" :key="pageIndex" class="result-accordion">
              <div class="accordion-header" @click="toggleAccordion(pageIndex)">
                <h5>{{ page.url }}</h5>
                <span>Errors: {{ page.errorCount }} | Warnings: {{ page.warningCount }} | Notices: {{ page.noticeCount }}</span>
                <span class="accordion-icon">{{ isAccordionOpen(pageIndex) ? '▼' : '▶' }}</span>
              </div>
              <div v-if="isAccordionOpen(pageIndex)" class="accordion-content">
                <ul class="issue-list">
                  <li v-for="(issue, issueIndex) in page.issues" :key="issueIndex" :class="issue.type">
                    <strong>{{ issue.type.toUpperCase() }}:</strong> {{ issue.message }}
                    <div class="issue-details">
                      <p>Context:</p>
                      <small class="context">{{ issue.context }}</small>
                      <p>Selector:</p>
                      <small class="selector">{{ issue.selector }}</small>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-if="history.length">
            <h3>Scan History</h3>
            <div class="pagination">
              <button @click="prevHistoryPage" :disabled="currentHistoryPage === 1">Previous</button>
              <span>Page {{ currentHistoryPage }} of {{ totalHistoryPages }}</span>
              <button @click="nextHistoryPage" :disabled="currentHistoryPage === totalHistoryPages">Next</button>
            </div>
            <ul class="scan-history-list">
              <li v-for="result in paginatedHistory" :key="result._id" class="scan-history-item">
                <div @click="toggleDetails(result._id)" class="scan-history-summary">
                  <div class="scan-info">
                    <span class="scan-date">{{ new Date(result.date).toLocaleString() }}</span>
                    <span class="scan-url">{{ result.startUrl }}</span>
                  </div>
                  <div class="scan-results">
                    <span class="ruleset-tag">{{ result.ruleset }}</span>
                    <span class="result-count error">Errors: {{ result.totalErrors }}</span>
                    <span class="result-count warning">Warnings: {{ result.totalWarnings }}</span>
                    <span class="result-count notice">Notices: {{ result.totalNotices }}</span>
                  </div>
                  <span class="toggle-icon">{{ isDetailOpen(result._id) ? '▼' : '▶' }}</span>
                </div>
                <div v-if="isDetailOpen(result._id)" class="scan-history-details">
                  <h4>Scanned Pages:</h4>
                  <div class="pagination">
                    <button @click="prevResultPage(result._id)" :disabled="currentResultPages[result._id] === 1">Previous</button>
                    <span>Page {{ currentResultPages[result._id] || 1 }} of {{ totalResultPages(result) }}</span>
                    <button @click="nextResultPage(result._id)" :disabled="(currentResultPages[result._id] || 1) === totalResultPages(result)">Next</button>
                  </div>
                  <ul class="scanned-pages-list">
                    <li v-for="(page, pageIndex) in paginatedResultPages(result)" :key="pageIndex">
                      <div @click="togglePageDetails(result._id, pageIndex)" class="page-summary">
                        {{ page.url }} - Errors: {{ page.errorCount }}, Warnings: {{ page.warningCount }}, Notices: {{ page.noticeCount }}
                        <span class="toggle-icon">{{ isPageDetailOpen(result._id, pageIndex) ? '▼' : '▶' }}</span>
                      </div>
                      <div v-if="isPageDetailOpen(result._id, pageIndex)" class="page-details">
                        <ul class="issue-list">
                          <li v-for="(issue, issueIndex) in page.issues" :key="issueIndex" :class="issue.type">
                            <strong>{{ issue.type.toUpperCase() }}:</strong> {{ issue.message }}
                            <div class="issue-details">
                              <p>Context:</p>
                              <small class="context">{{ issue.context }}</small>
                              <p>Selector:</p>
                              <small class="selector">{{ issue.selector }}</small>
                            </div>
                          </li>
                        </ul>
                      </div>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
            <div class="pagination">
              <button @click="prevHistoryPage" :disabled="currentHistoryPage === 1">Previous</button>
              <span>Page {{ currentHistoryPage }} of {{ totalHistoryPages }}</span>
              <button @click="nextHistoryPage" :disabled="currentHistoryPage === totalHistoryPages">Next</button>
            </div>
            <AposButton label="Clear History" @click="clearHistory" />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
export default {
  props: {
    moduleName: String
  },
  emits: ['safe-close'],
  data() {
    return {
      modal: { active: false, showModal: false, type: 'overlay' },
      scanUrl: '',
      ruleset: 'WCAG2AA', // Default ruleset
      results: null,
      fullScan: false,
      scanProgress: '',
      history: [],
      loading: false,
      error: null,
      isReady: false,
      openDetails: new Set(),
      openAccordions: new Set(),
      currentPage: 1,
      itemsPerPage: 5,
      currentHistoryPage: 1,
      itemsPerHistoryPage: 5,
      currentResultPages: {},
      itemsPerResultPage: 10,
      openPageDetails: new Set()
    };
  },
  mounted() {
    this.modal.active = true;
    this.$nextTick(() => {
      this.isReady = true;
      this.fetchHistory();
      this.setScanUrl();
    });
  },
  computed: {
    totalHistoryPages() {
      return Math.ceil(this.history.length / this.itemsPerHistoryPage);
    },
    paginatedHistory() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.history.slice(start, end);
    }
  },
  methods: {
    ready() {
      this.$refs.cancelButton.$el.querySelector('button').focus();
    },
    async runScan() {
      this.loading = true;
      this.error = null;
      this.scanProgress = 'Starting scan...';
      this.results = null;

      try {
        const response = await apos.http.post('/api/v1/@bodonkey/pally-extension/scan', {
          body: {
            url: this.scanUrl,
            ruleset: this.ruleset,
            fullScan: this.fullScan
          }
        });

        if (response.resultData) {
          this.results = response.resultData;
          await this.fetchHistory();
        } else {
          throw new Error('Unexpected response format');
        }
      } catch (error) {
        this.error = error.message || 'An error occurred during the scan';
      } finally {
        this.loading = false;
        this.scanProgress = '';
      }
    },
    async fetchHistory() {
      console.log('Fetching history');
      try {
        const response = await fetch('/api/v1/@bodonkey/pally-extension/history');
        const data = await response.json();

        if (data && data.success) {
          this.history = data.data;
        } else {
          throw new Error('Unexpected response structure: ' + JSON.stringify(data));
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        this.error = 'Failed to load history: ' + (error.message || error);
      }
    },
    downloadResults() {
      const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(this.results, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'pa11y-results.json');
      document.body.appendChild(downloadAnchor); // Required for Firefox
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
    },
    toggleDetails(id) {
      if (this.openDetails.has(id)) {
        this.openDetails.delete(id);
      } else {
        this.openDetails.add(id);
      }
    },
    isDetailOpen(id) {
      return this.openDetails.has(id);
    },
    async clearHistory() {
      try {
        const response = await fetch('/api/v1/@bodonkey/pally-extension/clear-history', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
        });
        const data = await response.json();
        if (data.success) {
          this.history = [];
          this.error = null;
        } else {
          throw new Error('Failed to clear history');
        }
      } catch (error) {
        this.error = error.message || 'An error occurred while clearing history';
      }
    },
    toggleAccordion(index) {
      if (this.openAccordions.has(index)) {
        this.openAccordions.delete(index);
      } else {
        this.openAccordions.add(index);
      }
    },
    isAccordionOpen(index) {
      return this.openAccordions.has(index);
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
      }
    },
    prevHistoryPage() {
      if (this.currentHistoryPage > 1) {
        this.currentHistoryPage--;
      }
    },
    nextHistoryPage() {
      if (this.currentHistoryPage < this.totalHistoryPages) {
        this.currentHistoryPage++;
      }
    },
    totalResultPages(result) {
      return Math.ceil(result.results.length / this.itemsPerResultPage);
    },
    paginatedResultPages(result) {
      const currentPage = this.currentResultPages[result._id] || 1;
      const start = (currentPage - 1) * this.itemsPerResultPage;
      const end = start + this.itemsPerResultPage;
      return result.results.slice(start, end);
    },
    prevResultPage(resultId) {
      if (this.currentResultPages[resultId] > 1) {
        this.$set(this.currentResultPages, resultId, this.currentResultPages[resultId] - 1);
      }
    },
    nextResultPage(resultId) {
      const result = this.history.find(h => h._id === resultId);
      if (this.currentResultPages[resultId] < this.totalResultPages(result)) {
        this.$set(this.currentResultPages, resultId, (this.currentResultPages[resultId] || 1) + 1);
      }
    },
    togglePageDetails(resultId, pageIndex) {
      const key = `${resultId}-${pageIndex}`;
      if (this.openPageDetails.has(key)) {
        this.openPageDetails.delete(key);
      } else {
        this.openPageDetails.add(key);
      }
    },
    isPageDetailOpen(resultId, pageIndex) {
      return this.openPageDetails.has(`${resultId}-${pageIndex}`);
    },
    setScanUrl() {
      // Set the default scan URL to the current site URL
      this.scanUrl = window.location.origin;
    },
    cancel() {
      this.modal.showModal = false;
    }
  }
};
</script>

<style scoped>
/* Overall form styles */
.pa11y-scan-form {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.pa11y-scan-form h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
}

.form-control {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

select.form-control {
  height: 35px;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right .7em top 50%;
  background-size: .65em auto;
  padding-right: 1.4em;
}

.apos-button {
  margin-top: 10px;
  width: 100%;
}

/* Scan history list styles */
.scan-history-list {
  list-style-type: none;
  padding: 0;
}

.scan-history-item {
  margin-bottom: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.scan-history-summary {
  padding: 12px;
  cursor: pointer;
  background-color: #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.scan-history-summary:hover {
  background-color: #e0e0e0;
}

.scan-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.scan-date {
  font-weight: bold;
  margin-bottom: 2px;
}

.scan-url {
  font-size: 0.9em;
  color: #555;
}

.scan-results {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.ruleset-tag {
  background-color: #e0e0e0;
  color: #333;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  margin-right: 8px;
}

.result-count {
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 3px;
  margin-right: 5px;
  font-size: 0.9em;
}

.error {
  background-color: #ffdddd;
  color: #d8000c;
}

.warning {
  background-color: #feefb3;
  color: #9f6000;
}

.notice {
  background-color: #bde5f8;
  color: #00529b;
}

.toggle-icon {
  font-size: 12px;
  margin-left: 10px;
}

/* Scan history details styles */
.scan-history-details {
  padding: 10px;
  border-top: 1px solid #ddd;
  background-color: #ffffff;
}

.issue-list {
  list-style-type: none;
  padding: 0;
}

.issue-list li {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 4px;
}

.issue-details {
  margin-top: 5px;
}

.context,
.selector {
  display: block;
  padding: 5px;
  background-color: #f9f9f9;
  border-left: 3px solid #ddd;
  margin-top: 5px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  font-size: 0.9em;
}
.page-summary {
  cursor: pointer;
  padding: 5px;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  margin-bottom: 5px;
}

.page-details {
  padding: 10px;
  border: 1px solid #ddd;
  border-top: none;
  margin-bottom: 10px;
}
</style>
