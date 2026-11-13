import React from 'react';
import { Layout } from 'react-admin';
import { CustomAppBar } from './CustomAppBar';
import { CustomSidebar } from './CustomSidebar';
import { useContentLocale } from '../lib/contentLocale';

export const CustomLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const contentLocale = useContentLocale();
  return (
    <Layout appBar={CustomAppBar} sidebar={CustomSidebar}>
      {/* Remount the page on a language switch so forms load the other language's values */}
      <React.Fragment key={contentLocale}>{children}</React.Fragment>
    </Layout>
  );
};
