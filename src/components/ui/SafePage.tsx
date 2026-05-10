import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

export function SafePage({ children }: any) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
