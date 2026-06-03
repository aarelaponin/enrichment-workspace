<link rel="stylesheet" href="${resourceBase}?file=css/ew-main.css&v=${version?js_string}" />
<link rel="stylesheet" href="${resourceBase}?file=css/ew-detail.css&v=${version?js_string}" />

<#-- Override Joget content container padding so workspace fills full width -->
<style>
.ew-app-host {
    padding-top: 0 !important; padding-bottom: 0 !important; padding-right: 0 !important;
    margin-top: 0 !important; margin-bottom: 0 !important; margin-right: 0 !important;
    max-width: none !important;
}
</style>

<div class="ew-app" id="ew-root">

  <#-- Main area -->
    <#-- Top bar -->
    <div class="ew-top-bar">
      <div>
        <h1 id="ew-page-title">Enrichment Workspace <span class="ew-version-badge">v${version!''}</span></h1>
        <div class="ew-stm-filter" id="ew-stm-filter" style="display:none">
          Filtered: <span id="ew-stm-filter-val"></span>
          <a href="#" id="ew-stm-clear" onclick="EW_clearStmFilter(); return false;">Clear</a>
        </div>
      </div>
      <div class="ew-top-meta">
        <#if statementId?has_content>
          <span>Statement: ${statementId}</span> &middot;
        </#if>
        <span id="ew-record-count"></span>
        &middot; <span class="ew-status" id="ew-status"></span>
      </div>
    </div>

    <#-- Content area: dashboard + toolbar + filters + table rendered by JS -->
    <div class="ew-content" id="ew-content">
      <#-- Dashboard container -->
      <div id="ew-dashboard"></div>

      <#-- Toolbar -->
      <div class="ew-toolbar" id="ew-toolbar"></div>

      <#-- Filters bar -->
      <div class="ew-filters" id="ew-filters"></div>

      <#-- Table -->
      <div class="ew-table-wrap">
        <table class="ew-table" id="ew-table">
          <thead id="ew-thead"></thead>
          <tbody id="ew-tbody">
            <tr><td colspan="16" class="ew-loading">Loading records...</td></tr>
          </tbody>
        </table>
      </div>

      <#-- Reconciliation panel -->
      <div id="ew-recon-panel" style="display:none"></div>

      <#-- Pagination -->
      <div class="ew-pagination" id="ew-pagination"></div>
    </div>
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

<#-- JS modules (load order: config → api → toast → nav → dashboard → table → actions → detail → filters → main) -->
<script src="${resourceBase}?file=js/ew-config.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-api.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-toast.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-nav.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-dashboard.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-table.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-actions.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-detail.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-filters.js&v=${version?js_string}"></script>
<script src="${resourceBase}?file=js/ew-main.js&v=${version?js_string}"></script>
