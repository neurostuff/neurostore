import '@testing-library/jest-dom';
import 'regenerator-runtime/runtime';
import React from 'react';
import { vi } from 'vitest';

global.React = React;
global.URL.createObjectURL = vi.fn();
