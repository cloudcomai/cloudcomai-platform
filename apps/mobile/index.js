import './src/services/globalTheme.js';
import React from 'react';
import { registerRootComponent } from 'expo';
import App from './App';
import ConversationErrorBoundary from './src/components/ConversationErrorBoundary';

function CloudComAIRoot() {
  return (
    <ConversationErrorBoundary>
      <App />
    </ConversationErrorBoundary>
  );
}

registerRootComponent(CloudComAIRoot);
