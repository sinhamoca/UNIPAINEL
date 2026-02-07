// components/widgets/index.js
// Exportações centralizadas dos Widgets

export { default as WidgetsSection } from './WidgetsSection';
export { default as SyncKofficeIboWidget } from './SyncKofficeIboWidget';
export { default as SyncSigmaIboWidget } from './SyncSigmaIboWidget';
export { default as SyncUniplayIboWidget } from './SyncUniplayIboWidget';
export { default as TrialPlaylistWidget } from './TrialPlaylistWidget';

// Para criar um novo widget de sincronização:
// 1. Crie o arquivo SyncNomeWidget.jsx
// 2. Exporte aqui
// 3. Adicione no WidgetsSection.jsx
