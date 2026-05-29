/**
 * Swizzle wrapper for ApiTabs from docusaurus-theme-openapi-docs@4.7.1.
 * Same fix as SchemaTabs — see SchemaTabs/index.tsx for full explanation.
 */
import React from 'react';
import OriginalApiTabs from '@theme-original/ApiTabs';
import { TabsProvider, useTabsContextValue } from '@docusaurus/theme-common/internal';

export default function ApiTabs({ children, ...props }: React.ComponentProps<typeof OriginalApiTabs>): React.ReactElement {
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
            <OriginalApiTabs {...props}>{children}</OriginalApiTabs>
        </TabsProvider>
    );
}
