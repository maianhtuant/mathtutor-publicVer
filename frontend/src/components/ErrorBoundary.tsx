import { Component, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { colors, fonts, space } from '../theme';
import { Button } from './ui';

/** Shows a readable error with a way out instead of a blank page when a screen crashes. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating to another page clears the error.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    console.error('Screen crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ padding: space(10), alignItems: 'center', gap: space(3) }} role="alert">
        <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.ink }}>Something went wrong on this page.</Text>
        <Text style={{ color: colors.ink3, fontFamily: fonts.mono, fontSize: 12 }}>{this.state.error.message}</Text>
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <Button title="Reload page" onPress={() => window.location.reload()} />
          <Button variant="secondary" title="Go home" onPress={() => { window.location.hash = '#/'; }} />
        </View>
      </View>
    );
  }
}
