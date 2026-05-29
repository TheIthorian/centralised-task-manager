/**
 * Swizzle wrapper for ApiExplorer/CodeTabs from docusaurus-theme-openapi-docs@4.7.1.
 * Same fix as SchemaTabs — see SchemaTabs/index.tsx for full explanation.
 */
import React from 'react';
import OriginalCodeTabs from '@theme-original/ApiExplorer/CodeTabs';
import { TabsProvider, useTabsContextValue } from '@docusaurus/theme-common/internal';

export default function CodeTabs({ children, ...props }: React.ComponentProps<typeof OriginalCodeTabs>): JSX.Element {
    const values = React.useMemo(
        () =>
            React.Children.toArray(children)
                .filter(React.isValidElement)
                .map((child) => ({
                    value: (child as React.ReactElement).props.value as string,
                    label: ((child as React.ReactElement).props.label ??
                        (child as React.ReactElement).props.value) as string,
                })),
        [children],
    );

    const contextValue = useTabsContextValue({ ...props, values });

    return (
        <TabsProvider value={contextValue}>
            <OriginalCodeTabs {...props}>{children}</OriginalCodeTabs>
        </TabsProvider>
    );
}
