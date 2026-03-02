<link rel="stylesheet" href="${resourceBase}?file=css/ew-main.css&v=${version?js_string}" />
<link rel="stylesheet" href="${resourceBase}?file=css/ew-detail.css&v=${version?js_string}" />

<div class="ew-container" id="ew-root">

  <#-- Header -->
  <div class="ew-header">
    <h2><i class="fas fa-exchange-alt"></i> ${element.properties.label!''}</h2>
    <span class="ew-badge">v${version!''}</span>
    <#if statementId?has_content>
      <span class="ew-badge ew-badge-info">Statement: ${statementId}</span>
    </#if>
    <span class="ew-status" id="ew-status"></span>
  </div>

  <#-- Tab bar -->
  <div class="ew-tabs" id="ew-tabs">
    <button class="ew-tab active" data-tab="workspace">
      <i class="fas fa-exchange-alt"></i> Enrichment Workspace
      <span class="ew-tab-badge" id="ew-tab-badge-workspace"></span>
    </button>
    <button class="ew-tab" data-tab="ready">
      <i class="fas fa-check"></i> Ready for Posting
      <span class="ew-tab-badge" id="ew-tab-badge-ready"></span>
    </button>
    <button class="ew-tab" data-tab="confirmed">
      <i class="fas fa-lock"></i> Confirmed Records
      <span class="ew-tab-badge" id="ew-tab-badge-confirmed"></span>
    </button>
    <button class="ew-tab" data-tab="history">
      <i class="fas fa-code-branch"></i> Split/Merge History
    </button>
    <button class="ew-tab" data-tab="summary">
      <i class="fas fa-chart-bar"></i> Statement Summary
    </button>
  </div>

  <#-- Toolbar -->
  <div class="ew-toolbar" id="ew-toolbar"></div>

  <#-- Filters bar -->
  <div class="ew-filters" id="ew-filters">
    <select id="ew-filter-status" class="ew-select">
      <option value="">All active statuses</option>
      <option value="new">New</option>
      <option value="processing">Processing</option>
      <option value="enriched">Enriched</option>
      <option value="error">Error</option>
      <option value="manual_review">Manual Review</option>
      <option value="in_review">In Review</option>
      <option value="adjusted">Adjusted</option>
      <option value="ready">Ready</option>
      <option value="paired">Paired</option>
    </select>
    <select id="ew-filter-source" class="ew-select">
      <option value="">All sources</option>
      <option value="bank">Bank</option>
      <option value="secu">Securities</option>
    </select>
    <input type="text" id="ew-filter-customer" class="ew-input" placeholder="Customer ID..." />
    <button id="ew-btn-search" class="ew-btn"><i class="fas fa-search"></i> Search</button>
    <button id="ew-btn-reset" class="ew-btn ew-btn-secondary"><i class="fas fa-undo"></i> Reset</button>
    <span class="ew-record-count" id="ew-record-count"></span>
  </div>

  <#-- Table -->
  <div class="ew-table-wrap">
    <table class="ew-table" id="ew-table">
      <thead id="ew-thead">
        <#-- Rendered dynamically by ew-table.js based on current tab -->
      </thead>
      <tbody id="ew-tbody">
        <tr><td colspan="16" class="ew-loading">Loading records...</td></tr>
      </tbody>
    </table>
  </div>

  <#-- Pagination -->
  <div class="ew-pagination" id="ew-pagination"></div>

  <#-- Detail slide-over container -->
  <div id="ew-slide-container"></div>

</div>

<#-- Server-to-client config -->
<script>
window.EW_CONFIG = {
  apiBase: '${apiBase?js_string}',
  apiId: '${apiId?js_string}',
  apiKey: '${apiKey?js_string}',
  statementId: '${statementId?js_string}',
  pageSize: ${pageSize!'20'},
  version: '${version?js_string}'
};
</script>

<#-- JS modules (load order: config → api → toast → tabs → table → actions → filters → main) -->
<script src="${resourceBase}?file=js/ew-config.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-api.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-toast.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-tabs.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-table.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-actions.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-detail.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-filters.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-main.js&v=${version?js_string}"></script>
