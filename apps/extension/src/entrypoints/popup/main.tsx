import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './style.css';

const element = document.getElementById('root');
if (element === null) throw new Error('Popup root is missing');
createRoot(element).render(<React.StrictMode><App /></React.StrictMode>);
