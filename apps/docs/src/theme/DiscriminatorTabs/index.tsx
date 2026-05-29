/**
 * Swizzle wrapper for DiscriminatorTabs from docusaurus-theme-openapi-docs@4.7.1.
 * Same fix as SchemaTabs — see SchemaTabs/index.tsx for full explanation.
 */
import React from 'react';
import OriginalDiscriminatorTabs from '@theme-original/DiscriminatorTabs';
import { TabsProvider, useTabsContextValue } from '@docusaurus/theme-common/internal';

export default function DiscriminatorTabs({
    children,
    ...props
}: React.ComponentProps<typeof OriginalDiscriminatorTabs>): React.ReactElement {
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
            <OriginalDiscriminatorTabs {...props}>{children}</OriginalDiscriminatorTabs>
        </TabsProvider>
    );
}
