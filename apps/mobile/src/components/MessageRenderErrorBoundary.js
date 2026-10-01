import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const SAFE_ERROR_FIELDS = ['name', 'message'];

function sanitizeError(error) {
  const source = error || {};
  return SAFE_ERROR_FIELDS.reduce((result, key) => {
    const value = source?.[key];
    if (value) result[key] = String(value).slice(0, 240);
    return result;
  }, {});
}

export default class MessageRenderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: sanitizeError(error) };
  }

  componentDidCatch(error, info) {
    const logger = this.props.onError || console.error;
    logger('MESSAGE_RENDER_FAILURE', {
      messageId: this.props.messageId ?? null,
      error: sanitizeError(error),
      componentStack: String(info?.componentStack || '').slice(0, 1200),
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.messageId !== this.props.messageId && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unable to display this message.</Text>
        <Text style={styles.body}>This message could not be rendered, but the conversation is still available.</Text>
        {__DEV__ && this.state.error?.message ? <Text selectable style={styles.debug}>{this.state.error.message}</Text> : null}
        <Pressable accessibilityRole="button" onPress={this.handleRetry} style={styles.retry}>
          <Text style={styles.retryText}>Retry message</Text>
        </Pressable>
      </View>
    );
  }
}

export { sanitizeError };

const styles = StyleSheet.create({
  container: { width: '100%', minHeight: 96, marginBottom: 9, padding: 12, borderRadius: 14, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' },
  title: { color: '#9a3412', fontWeight: '700' },
  body: { marginTop: 4, color: '#7c2d12', fontSize: 12, lineHeight: 17 },
  debug: { marginTop: 8, color: '#7c2d12', fontSize: 11 },
  retry: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fff' },
  retryText: { color: '#3157d5', fontWeight: '700' },
});
