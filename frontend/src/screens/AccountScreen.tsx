import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Card, ErrorBox, Field, H2, Loading, Muted, Notice, Screen, formatDate } from '../components/ui';
import { useAction, useApi } from '../hooks';
import { navigate } from '../router';
import { colors, space } from '../theme';
import { roleLabel, type Role } from '../types';

interface Account {
  id: string; email: string; fullName: string; role: Role; status: string; createdAt: string;
  courses: { id: string; title: string; enrolledAt: string }[];
}

/** "My account": change name / email (email needs the current password) and change password. */
export default function AccountScreen() {
  const { refresh } = useAuth();
  const { data: account, setData, error, loading } = useApi<Account>('/me/account');
  const [profile, setProfile] = useState({ fullName: '', email: '', currentPassword: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const profileAction = useAction();
  const passwordAction = useAction();

  useEffect(() => {
    if (account) setProfile({ fullName: account.fullName, email: account.email, currentPassword: '' });
  }, [account]);

  if (loading && !account) return <Loading />;
  if (!account) return <Screen title="My account"><ErrorBox message={error} /></Screen>;

  const emailChanged = profile.email.trim().toLowerCase() !== account.email;
  const profileDirty = profile.fullName.trim() !== account.fullName || emailChanged;
  const saveProfile = () => profileAction.run(async () => {
    const u = await api.patch<{ fullName: string; email: string }>('/me', {
      fullName: profile.fullName, email: profile.email, currentPassword: emailChanged ? profile.currentPassword : undefined,
    });
    setData({ ...account, fullName: u.fullName, email: u.email });
    await refresh();
  }, 'Your details were saved');

  const pwProblem = pw.newPassword && pw.newPassword.length < 8 ? 'Use at least 8 characters'
    : pw.confirm && pw.confirm !== pw.newPassword ? 'The two new passwords do not match' : null;
  const changePassword = () => passwordAction.run(async () => {
    await api.post('/me/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
    setPw({ currentPassword: '', newPassword: '', confirm: '' });
  }, 'Your password was changed');

  return (
    <Screen kicker="Account" title="My account" subtitle="Update your name, email and password.">
      <View style={styles.grid}>
        <Card style={styles.card}>
          <H2>Profile</H2>
          <ErrorBox message={profileAction.error} />
          <Notice message={profileAction.notice} />
          <Field label="Full name" value={profile.fullName} onChangeText={(fullName) => setProfile({ ...profile, fullName })} autoComplete="name" />
          <Field label="Email" value={profile.email} onChangeText={(email) => setProfile({ ...profile, email })}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" hint="Used to log in." />
          {emailChanged ? (
            <Field label="Current password" value={profile.currentPassword} secureTextEntry autoComplete="current-password"
              onChangeText={(currentPassword) => setProfile({ ...profile, currentPassword })}
              hint="Needed to confirm that you want to change your login email." />
          ) : null}
          <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
            <Button title="Save details" onPress={saveProfile} loading={profileAction.busy}
              disabled={!profileDirty || !profile.fullName.trim() || !profile.email.trim() || (emailChanged && !profile.currentPassword)} />
            {profileDirty ? <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '600' }}>● unsaved changes</Text> : null}
          </View>
        </Card>

        <Card style={styles.card}>
          <H2>Change password</H2>
          <ErrorBox message={passwordAction.error} />
          <Notice message={passwordAction.notice} />
          <Field label="Current password" value={pw.currentPassword} secureTextEntry autoComplete="current-password"
            onChangeText={(currentPassword) => setPw({ ...pw, currentPassword })} />
          <Field label="New password" value={pw.newPassword} secureTextEntry autoComplete="new-password"
            onChangeText={(newPassword) => setPw({ ...pw, newPassword })} hint="At least 8 characters." />
          <Field label="Confirm new password" value={pw.confirm} secureTextEntry autoComplete="new-password"
            onChangeText={(confirm) => setPw({ ...pw, confirm })} error={pwProblem} onSubmitEditing={() => !pwProblem && changePassword()} />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Change password" onPress={changePassword} loading={passwordAction.busy}
              disabled={!pw.currentPassword || !pw.newPassword || pw.newPassword !== pw.confirm || !!pwProblem} />
          </View>
        </Card>
      </View>

      <Card>
        <H2>About your account</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(4), alignItems: 'center', marginBottom: space(3) }}>
          <Badge tone={account.role === 'USER' ? 'neutral' : 'primary'} text={roleLabel[account.role] ?? account.role} />
          <Muted>Member since {formatDate(account.createdAt).split(',')[0]}</Muted>
        </View>
        <Text style={styles.label}>YOUR COURSES</Text>
        {account.courses.length ? (
          <View style={{ gap: space(1.5), marginTop: space(2) }}>
            {account.courses.map((c) => (
              <Pressable key={c.id} onPress={() => navigate(`/courses/${c.id}`)} accessibilityRole="link">
                {({ hovered }: any) => (
                  <Text style={[styles.course, hovered && { textDecorationLine: 'underline' }]}>
                    {c.title} <Text style={{ color: colors.ink3, fontWeight: '400' }}>· enrolled {formatDate(c.enrolledAt).split(',')[0]}</Text>
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(2) }}>
            <Muted>You are not enrolled in any course yet.</Muted>
            <Button small variant="secondary" title="Browse courses" onPress={() => navigate('/courses')} />
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(4), alignItems: 'flex-start' },
  card: { flexGrow: 1, flexBasis: 380 },
  label: { fontSize: 11.5, letterSpacing: 1.2, color: colors.ink3 },
  course: { fontSize: 15, color: colors.link, fontWeight: '600' },
});
