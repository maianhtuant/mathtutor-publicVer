import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '../auth';
import { Button, ErrorBox, Field, Muted } from '../components/ui';
import { useAction } from '../hooks';
import { navigate } from '../router';
import { colors, space } from '../theme';
import { AuthFrame } from './LoginScreen';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();
  const submit = () => run(async () => { await register(email, password, fullName); });  // App redirects to the remembered page once logged in
  const tooShort = password.length > 0 && password.length < 8;

  return (
    <AuthFrame title="Start free.">
      <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password"
        hint="At least 8 characters" error={tooShort ? 'Password is too short' : null} onSubmitEditing={submit} />
      <ErrorBox message={error} />
      <View style={{ marginTop: space(3) }}>
        <Button title="Register" onPress={submit} loading={busy} disabled={!email || !fullName || password.length < 8} />
      </View>
      <Muted style={{ marginTop: space(3), fontSize: 12 }}>
        Practice sets become available after an administrator assigns them to your account.
      </Muted>
      <Pressable onPress={() => navigate('/login')} style={{ marginTop: space(4) }}>
        <Muted>Already registered? <Text style={{ color: colors.accentInk, fontWeight: '600' }}>Log in</Text></Muted>
      </Pressable>
    </AuthFrame>
  );
}
