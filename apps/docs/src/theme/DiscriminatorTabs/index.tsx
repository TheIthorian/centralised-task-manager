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
}: React.ComponentProps<typeof OriginalDiscriminatorTabs>): JSX.Element {
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
            <OriginalDiscriminatorTabs {...props}>{children}</OriginalDiscriminatorTabs>
        </TabsProvider>
    );
}
