import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// findBy*/waitFor poll for 1000ms by default, separate from vitest's testTimeout
configure({ asyncUtilTimeout: 10000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    // jsdom without storage
  }
});
