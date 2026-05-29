/**
 * Swizzle wrapper for SchemaTabs from docusaurus-theme-openapi-docs@4.7.1.
 *
 * In Docusaurus 3.10.x, useTabs() became a pure context consumer — it no
 * longer accepts props and manages its own state; it reads from TabsContext.
 * The plugin's TabsComponent calls useTabs(props) expecting the old API.
 *
 * Fix: use useTabsContextValue() (the 3.10.x state factory) to create the full
 * context value and feed it into TabsProvider so the original component can
 * find it via useContext().
 */
import React from 'react';
import OriginalSchemaTabs from '@theme-original/SchemaTabs';
import { TabsProvider, useTabsContextValue } from '@docusaurus/theme-common/internal';

export default function SchemaTabs({
    children,
    ...props
}: React.ComponentProps<typeof OriginalSchemaTabs>): React.ReactElement {
    const values = React.useMemo(
        () =>
            React.Children.toArray(children)
                .filter(React.isValidElement)
                .map((child) => {
                    const p = (child as React.ReactElement<Record<string, unknown>>).props;
                    return {
                        value: p['value'] as string,
                        label: (p['label'] ?? p['value']) as string,
                    };
                }),
        [children],
    );

    const contextValue = useTabsContextValue({ ...props, values });

    return (
        <TabsProvider value={contextValue}>
            <OriginalSchemaTabs {...props}>{children}</OriginalSchemaTabs>
        </TabsProvider>
    );
}
