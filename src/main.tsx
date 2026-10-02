import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './themes/sangtian-shanhe.css';
import { registerPythonRuntimeServiceWorker } from './services/pythonRuntimeServiceWorker.ts';

void registerPythonRuntimeServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
