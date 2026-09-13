import React from 'react';
import { StoreProvider } from './context/StoreContext';
import { CustomerStoreApp } from './apps/CustomerStoreApp';

export default function App() {
  return (
    <StoreProvider>
      <CustomerStoreApp />
    </StoreProvider>
  );
}

