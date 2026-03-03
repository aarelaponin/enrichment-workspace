package org.joget.gam.enrichment.ui;

import java.util.HashMap;
import java.util.Map;
import org.joget.apps.app.service.AppUtil;
import org.joget.apps.userview.model.UserviewBuilderPalette;
import org.joget.apps.userview.model.UserviewMenu;
import org.joget.commons.util.LogUtil;
import org.joget.plugin.base.PluginManager;

/**
 * Enrichment Workspace — custom Userview menu plugin.
 *
 * <p>Renders the F01.05 enrichment workspace using a FreeMarker template
 * with external CSS/JS served via {@link EnrichmentWorkspaceResources}.</p>
 */
public class EnrichmentWorkspaceMenu extends UserviewMenu {

    private static final String VERSION = "0.7.0";

    // ── Plugin identity ────────────────────────────────────────────────────

    @Override
    public String getName() {
        return "Enrichment Workspace";
    }

    @Override
    public String getVersion() {
        return VERSION;
    }

    @Override
    public String getDescription() {
        return "Manual enrichment workspace for F01.05 transactions — "
                + "inline editing, split/merge, confirm-for-posting.";
    }

    @Override
    public String getLabel() {
        return "Enrichment Workspace";
    }

    @Override
    public String getClassName() {
        return getClass().getName();
    }

    // ── Userview Builder palette ───────────────────────────────────────────

    @Override
    public String getCategory() {
        return UserviewBuilderPalette.CATEGORY_CUSTOM;
    }

    @Override
    public String getIcon() {
        return "<i class=\"fas fa-exchange-alt\"></i>";
    }

    @Override
    public boolean isHomePageSupported() {
        return true;
    }

    // ── Plugin configuration ───────────────────────────────────────────────

    @Override
    public String getPropertyOptions() {
        return AppUtil.readPluginResource(getClass().getName(),
                "/properties/enrichmentWorkspaceMenu.json", null, true,
                "messages/EnrichmentWorkspaceMenu");
    }

    // ── Rendering ──────────────────────────────────────────────────────────

    @Override
    public String getDecoratedMenu() {
        return null;
    }

    @Override
    public String getRenderPage() {
        try {
            Map<String, Object> model = new HashMap<>();
            model.put("element", this);
            model.put("request", getRequestParameters());

            // API config from plugin properties
            String apiId = getPropertyString("apiId");
            String apiKey = getPropertyString("apiKey");
            model.put("apiId", apiId != null ? apiId : "");
            model.put("apiKey", apiKey != null ? apiKey : "");
            String apiBase = getPropertyString("apiBaseUrl");
            model.put("apiBase", (apiBase != null && !apiBase.isEmpty()) ? apiBase : "/jw/api/enrichment");

            // Context
            String statementId = getRequestParameterString("statement_id");
            model.put("statementId", statementId != null ? statementId : "");

            // Pagination default
            String pageSize = getPropertyString("pageSize");
            model.put("pageSize", (pageSize != null && !pageSize.isEmpty()) ? pageSize : "20");

            // Version for cache-busting
            model.put("version", VERSION);

            // Resource base URL for static files
            model.put("resourceBase", getResourceBaseUrl());

            PluginManager pm = (PluginManager) AppUtil.getApplicationContext().getBean("pluginManager");
            return pm.getPluginFreeMarkerTemplate(model, getClass().getName(),
                    "/templates/enrichmentWorkspace.ftl", "messages/EnrichmentWorkspaceMenu");

        } catch (Exception e) {
            LogUtil.error(getClassName(), e, "Error rendering Enrichment Workspace");
            return "<div class='alert alert-danger'>Error rendering Enrichment Workspace: "
                    + e.getMessage() + "</div>";
        }
    }

    // ── Internal helpers ────────────────────────────────────────────────────

    private String getResourceBaseUrl() {
        return "/jw/web/json/plugin/"
                + EnrichmentWorkspaceResources.class.getName()
                + "/service";
    }
}
