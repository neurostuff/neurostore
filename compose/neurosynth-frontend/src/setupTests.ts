import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

global.React = React;
global.URL.createObjectURL = vi.fn();
