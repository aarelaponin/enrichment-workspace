package org.joget.gam.enrichment.ui;

import org.junit.Before;
import org.junit.Test;

import static org.junit.Assert.*;

/**
 * Tests for EnrichmentWorkspaceMenu — plugin identity and configuration.
 */
public class EnrichmentWorkspaceMenuTest {

    private EnrichmentWorkspaceMenu menu;

    @Before
    public void setUp() {
        menu = new EnrichmentWorkspaceMenu();
    }

    @Test
    public void testGetName() {
        assertEquals("Enrichment Workspace", menu.getName());
    }

    @Test
    public void testGetVersion() {
        assertEquals("2.0.12", menu.getVersion());
    }

    @Test
    public void testGetDescription() {
        assertNotNull(menu.getDescription());
        assertTrue(menu.getDescription().contains("enrichment"));
    }

    @Test
    public void testGetCategory() {
        assertNotNull(menu.getCategory());
        // Should be UserviewBuilderPalette.CATEGORY_CUSTOM
        assertEquals("Custom", menu.getCategory());
    }
}
