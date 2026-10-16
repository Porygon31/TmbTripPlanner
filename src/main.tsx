import 'leaflet/dist/leaflet.css';
import 'uplot/dist/uPlot.min.css';
import './styles/app.css';
import './styles/atelier.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
