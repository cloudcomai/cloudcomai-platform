import React from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

const SAFE_ERROR_FIELDS = ['name', 'message'];

function sanitizeError(error) {
  const source = error || {};
  return SAFE_ERROR_FIELDS.reduce((result, key) => {
    const value = source?.[key];
    if (value) result[key] = String(value).slice(0, 240);
    return result;
  }, {});
}

export default class ConversationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
    this.backSubscription = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: sanitizeError(error) };
  }

  componentDidCatch(error, info) {
    const logger = this.props.onError || console.error;
    logger('CHAT_RENDER_FAILURE', {
      error: sanitizeError(error),
      componentStack: String(info?.componentStack || '').slice(0, 2000),
    });
  }

  componentDidUpdate(_prevProps, prevState) {
    if (!prevState.hasError && this.state.hasError && !this.backSubscription) {
      this.backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
        this.handleBackToChats();
        return true;
      });
    }
    if (prevState.hasError && !this.state.hasError && this.backSubscription) {
      this.backSubscription.remove();
      this.backSubscription = null;
    }
  }

  componentWillUnmount() {
    this.backSubscription?.remove();
    this.backSubscription = null;
  }

  handleBackToChats = () => {
    this.props.onBackToChats?.();
    this.setState({ hasError: false, error: null, resetKey: this.state.resetKey + 1 });
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, resetKey: this.state.resetKey + 1 });
  };

  renderFallback() {
    const errorMessage = this.state.error?.message;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unable to load this conversation.</Text>
        <Text style={styles.body}>CloudComAI stayed responsive and the failed conversation was isolated. You can retry or return to Chats without force stopping the app.</Text>
        {__DEV__ && errorMessage ? <Text selectable style={styles.debug}>{errorMessage}</Text> : null}
        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={this.handleRetry}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={this.handleBackToChats}>
          <Text style={styles.secondaryButtonText}>Back to Chats</Text>
        </Pressable>
      </View>
    );
  }

  render() {
    if (this.state.hasError) return this.renderFallback();
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

export { sanitizeError };

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f7f9fc' },
  title: { fontSize: 22, fontWeight: '700', color: '#172033', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, color: '#536079', textAlign: 'center', marginBottom: 18 },
  debug: { width: '100%', marginBottom: 16, padding: 10, backgroundColor: '#eef2ff', color: '#536079', borderRadius: 8 },
  primaryButton: { minWidth: 180, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#3157d5', alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { minWidth: 180, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: '#3157d5', alignItems: 'center' },
  secondaryButtonText: { color: '#3157d5', fontWeight: '700' },
});
