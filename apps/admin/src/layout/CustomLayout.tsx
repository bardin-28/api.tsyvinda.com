import React from 'react';
import { Layout } from 'react-admin';
import { CustomAppBar } from './CustomAppBar';
import { CustomSidebar } from './CustomSidebar';

export const CustomLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <Layout appBar={CustomAppBar} sidebar={CustomSidebar}>
    {children}
  </Layout>
);
