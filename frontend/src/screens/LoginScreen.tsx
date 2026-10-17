import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '../auth';
import { Button, Card, ErrorBox, Field, Muted } from '../components/ui';
import { useAction } from '../hooks';
import { navigate } from '../router';
import { colors, fonts, shadow, space } from '../theme';

export function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(4), backgroundColor: colors.paper }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 44, color: colors.ink, marginBottom: space(1), letterSpacing: -0.8 }}>
        {title}
      </Text>
      <Muted style={{ marginBottom: space(6), fontSize: 15 }}>Learn, practice and track your progress.</Muted>
      <Card style={{ width: '100%', maxWidth: 420, ...shadow.md }}>
        {children}
      </Card>
    </View>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  const submit = () => run(async () => { await login(email, password); });  // App redirects to the remembered page once logged in

  return (
    <AuthFrame title="Welcome back.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} autoComplete="current-password" />
      <ErrorBox message={error} />
      <View style={{ marginTop: space(3) }}>
        <Button title="Log in" onPress={submit} loading={busy} disabled={!email || !password} />
      </View>
      <Pressable onPress={() => navigate('/register')} style={{ marginTop: space(4) }}>
        <Muted>No account? <Text style={{ color: colors.accentInk, fontWeight: '600' }}>Register</Text></Muted>
      </Pressable>
    </AuthFrame>
  );
}
