package org.joget.gam.enrichment.ui;

import java.util.ArrayList;
import java.util.Collection;
import org.osgi.framework.BundleActivator;
import org.osgi.framework.BundleContext;
import org.osgi.framework.ServiceRegistration;

public class Activator implements BundleActivator {

    protected Collection<ServiceRegistration> registrationList;

    @Override
    public void start(BundleContext context) {
        registrationList = new ArrayList<>();

        // Register the Enrichment Workspace menu plugin
        registrationList.add(context.registerService(
                EnrichmentWorkspaceMenu.class.getName(),
                new EnrichmentWorkspaceMenu(),
                null
        ));

        // Register the static resources plugin (PluginWebSupport)
        registrationList.add(context.registerService(
                EnrichmentWorkspaceResources.class.getName(),
                new EnrichmentWorkspaceResources(),
                null
        ));
    }

    @Override
    public void stop(BundleContext context) {
        for (ServiceRegistration registration : registrationList) {
            registration.unregister();
        }
    }
}
