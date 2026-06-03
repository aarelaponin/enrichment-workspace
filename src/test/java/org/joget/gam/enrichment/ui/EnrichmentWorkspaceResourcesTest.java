package org.joget.gam.enrichment.ui;

import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/**
 * Tests for EnrichmentWorkspaceResources — static resource serving with security checks.
 */
public class EnrichmentWorkspaceResourcesTest {

    private EnrichmentWorkspaceResources resources;
    private HttpServletRequest request;
    private HttpServletResponse response;

    @Before
    public void setUp() {
        resources = new EnrichmentWorkspaceResources();
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
    }

    // ── Path traversal ──────────────────────────────────────────────────────

    @Test
    public void testPathTraversalBlocked_dotDot() throws Exception {
        when(request.getParameter("file")).thenReturn("../../etc/passwd");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    @Test
    public void testPathTraversalBlocked_encodedSlash() throws Exception {
        when(request.getParameter("file")).thenReturn("..%2f..%2fetc/passwd");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    @Test
    public void testPathTraversalBlocked_encodedDots() throws Exception {
        when(request.getParameter("file")).thenReturn("%2e%2e/etc/passwd");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    // ── Extension whitelist ─────────────────────────────────────────────────

    @Test
    public void testAllowedExtension_js() throws Exception {
        when(request.getParameter("file")).thenReturn("js/ew-config.js");
        resources.webService(request, response);
        // Should NOT get a 403 for extension — may get 404 if resource not on classpath
        verify(response, never()).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    @Test
    public void testAllowedExtension_css() throws Exception {
        when(request.getParameter("file")).thenReturn("css/ew-main.css");
        resources.webService(request, response);
        verify(response, never()).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    @Test
    public void testBlockedExtension_html() throws Exception {
        when(request.getParameter("file")).thenReturn("test.html");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    @Test
    public void testBlockedExtension_java() throws Exception {
        when(request.getParameter("file")).thenReturn("Activator.java");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    @Test
    public void testBlockedExtension_exe() throws Exception {
        when(request.getParameter("file")).thenReturn("malware.exe");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }

    // ── Content type ────────────────────────────────────────────────────────

    @Test
    public void testContentTypeMapping_js() throws Exception {
        when(request.getParameter("file")).thenReturn("js/ew-config.js");
        resources.webService(request, response);
        verify(response).setContentType("application/javascript; charset=UTF-8");
    }

    @Test
    public void testContentTypeMapping_css() throws Exception {
        when(request.getParameter("file")).thenReturn("css/ew-main.css");
        resources.webService(request, response);
        verify(response).setContentType("text/css; charset=UTF-8");
    }

    // ── Cache headers ───────────────────────────────────────────────────────

    @Test
    public void testCacheHeadersWithVersion() throws Exception {
        when(request.getParameter("file")).thenReturn("js/ew-config.js");
        when(request.getParameter("v")).thenReturn("2.0.0");
        resources.webService(request, response);
        verify(response).setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }

    @Test
    public void testCacheHeadersWithoutVersion() throws Exception {
        when(request.getParameter("file")).thenReturn("js/ew-config.js");
        when(request.getParameter("v")).thenReturn(null);
        resources.webService(request, response);
        verify(response).setHeader("Cache-Control", "public, max-age=3600");
    }

    // ── Missing file / param ────────────────────────────────────────────────

    @Test
    public void testMissingFileReturns404() throws Exception {
        when(request.getParameter("file")).thenReturn("js/nonexistent.js");
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_NOT_FOUND), anyString());
    }

    @Test
    public void testMissingFileParamReturns400() throws Exception {
        when(request.getParameter("file")).thenReturn(null);
        resources.webService(request, response);
        verify(response).sendError(eq(HttpServletResponse.SC_BAD_REQUEST), anyString());
    }
}
