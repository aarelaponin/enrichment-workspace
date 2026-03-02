package org.joget.gam.enrichment.ui;

import org.joget.commons.util.LogUtil;
import org.joget.plugin.base.ExtDefaultPlugin;
import org.joget.plugin.base.PluginWebSupport;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Serves static resources (JS, CSS) for the Enrichment Workspace plugin.
 *
 * <p>Access via:
 * {@code /jw/web/json/plugin/org.joget.gam.enrichment.ui.EnrichmentWorkspaceResources/service?file=css/ew-main.css}
 *
 * <p>Supports versioned caching: append {@code &v=0.3.0} for immutable cache headers.
 */
public class EnrichmentWorkspaceResources extends ExtDefaultPlugin implements PluginWebSupport {

    private static final String CLASS_NAME = EnrichmentWorkspaceResources.class.getName();

    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(Arrays.asList(
            ".js", ".css"
    ));

    @Override
    public String getName() {
        return "Enrichment Workspace Resources";
    }

    @Override
    public String getVersion() {
        return "0.3.0";
    }

    @Override
    public String getDescription() {
        return "Serves static resources (JS, CSS) for the Enrichment Workspace plugin";
    }

    @Override
    public void webService(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String file = request.getParameter("file");

        if (file == null || file.isEmpty()) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Missing 'file' parameter");
            return;
        }

        // URL decode to catch encoded traversal attempts
        String decodedFile;
        try {
            decodedFile = URLDecoder.decode(file, StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            LogUtil.warn(CLASS_NAME, "Failed to decode file parameter: " + file);
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid file parameter");
            return;
        }

        // Security: prevent directory traversal
        if (containsTraversalPattern(file) || containsTraversalPattern(decodedFile)) {
            LogUtil.warn(CLASS_NAME, "Blocked potential directory traversal: " + file);
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Invalid file path");
            return;
        }

        // Security: whitelist allowed file extensions
        if (!hasAllowedExtension(decodedFile)) {
            LogUtil.warn(CLASS_NAME, "Blocked disallowed file extension: " + file);
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "File type not allowed");
            return;
        }

        // Content type
        String contentType = getContentType(decodedFile);
        response.setContentType(contentType);

        // Security headers
        response.setHeader("X-Content-Type-Options", "nosniff");

        // Versioned caching
        String version = request.getParameter("v");
        if (version != null && !version.isEmpty()) {
            response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
            response.setHeader("Cache-Control", "public, max-age=3600");
        }

        // Load from classpath
        String resourcePath = "/static/" + decodedFile;
        try {
            URL resourceUrl = getClass().getResource(resourcePath);
            if (resourceUrl == null) {
                LogUtil.warn(CLASS_NAME, "Resource not found: " + resourcePath);
                response.sendError(HttpServletResponse.SC_NOT_FOUND, "Resource not found: " + file);
                return;
            }

            try (InputStream in = resourceUrl.openStream();
                 OutputStream out = response.getOutputStream()) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = in.read(buffer)) != -1) {
                    out.write(buffer, 0, bytesRead);
                }
                out.flush();
            }
        } catch (Exception e) {
            LogUtil.error(CLASS_NAME, e, "Error serving resource: " + file);
            response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error loading resource");
        }
    }

    private boolean containsTraversalPattern(String path) {
        return path.contains("..") || path.contains("\\") ||
                path.contains("%2e") || path.contains("%2E") ||
                path.contains("%5c") || path.contains("%5C");
    }

    private boolean hasAllowedExtension(String filename) {
        String lower = filename.toLowerCase();
        for (String ext : ALLOWED_EXTENSIONS) {
            if (lower.endsWith(ext)) {
                return true;
            }
        }
        return false;
    }

    private String getContentType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".js")) {
            return "application/javascript; charset=UTF-8";
        } else if (lower.endsWith(".css")) {
            return "text/css; charset=UTF-8";
        } else {
            return "application/octet-stream";
        }
    }
}
