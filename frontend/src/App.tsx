import { ReactNode, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import logo from './assets/logo.png';
import { AuthProvider, useAuth } from './auth';
import { Button, Loading } from './components/ui';
import { match, navigate, rememberReturnPath, takeReturnPath, usePath } from './router';
import { isStaff } from './types';
import { colors, fonts, space } from './theme';
import LandingScreen from './screens/LandingScreen';
import VideosScreen from './screens/videos/VideosScreen';
import VideoDetailScreen from './screens/videos/VideoDetailScreen';
import AdminVideosScreen from './screens/admin/AdminVideosScreen';
import VideoEditorScreen from './screens/admin/VideoEditorScreen';
import ContentTreeScreen from './screens/admin/ContentTreeScreen';
import LessonEditorScreen from './screens/admin/LessonEditorScreen';
import AdminSidebar from './components/AdminSidebar';
import ErrorBoundary from './components/ErrorBoundary';
import AccountScreen from './screens/AccountScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/student/DashboardScreen';
import CoursesScreen from './screens/student/CoursesScreen';
import CourseScreen from './screens/student/CourseScreen';
import LessonScreen from './screens/student/LessonScreen';
import PracticeListScreen from './screens/student/PracticeListScreen';
import AttemptScreen from './screens/student/AttemptScreen';
import HistoryScreen from './screens/student/HistoryScreen';
import UsersScreen from './screens/admin/UsersScreen';
import UserDetailScreen from './screens/admin/UserDetailScreen';
import ContentScreen from './screens/admin/ContentScreen';
import CourseEditorScreen from './screens/admin/CourseEditorScreen';
import TemplatesScreen from './screens/admin/TemplatesScreen';
import TemplateEditorScreen from './screens/admin/TemplateEditorScreen';
import PracticeSetsScreen from './screens/admin/PracticeSetsScreen';
import PracticeSetEditorScreen from './screens/admin/PracticeSetEditorScreen';
import QuestionsScreen from './screens/admin/QuestionsScreen';
import ReportsScreen from './screens/admin/ReportsScreen';
import AdminAttemptScreen from './screens/admin/AdminAttemptScreen';

type Route = { pattern: string; render: (p: Record<string, string>) => ReactNode };

/** Lesson videos are public (PUBLIC visibility) and also part of the signed-in app. */
const videoRoutes: Route[] = [
  { pattern: '/videos', render: () => <VideosScreen /> },
  { pattern: '/videos/:id', render: (p) => <VideoDetailScreen id={p.id} /> },
];

const publicRoutes: Route[] = [
  { pattern: '/', render: () => <LandingScreen /> },
  { pattern: '/login', render: () => <LoginScreen /> },
  { pattern: '/register', render: () => <RegisterScreen /> },
  ...videoRoutes,
];

const studentRoutes: Route[] = [
  { pattern: '/account', render: () => <AccountScreen /> },
  { pattern: '/', render: () => <DashboardScreen /> },
  { pattern: '/courses', render: () => <CoursesScreen /> },
  { pattern: '/courses/:id', render: (p) => <CourseScreen id={p.id} /> },
  { pattern: '/lessons/:id', render: (p) => <LessonScreen id={p.id} /> },
  { pattern: '/practice', render: () => <PracticeListScreen /> },
  { pattern: '/attempts/:id', render: (p) => <AttemptScreen id={p.id} /> },
  { pattern: '/history', render: () => <HistoryScreen /> },
  ...videoRoutes,
];

// Student course / lesson pages, also reachable by admins through "View as student".
const learningRoutes: Route[] = [
  { pattern: '/courses', render: () => <CoursesScreen /> },
  { pattern: '/courses/:id', render: (p) => <CourseScreen id={p.id} /> },
  { pattern: '/lessons/:id', render: (p) => <LessonScreen id={p.id} /> },
];

const adminRoutes: Route[] = [
  { pattern: '/account', render: () => <AccountScreen /> },
  { pattern: '/', render: () => <ContentTreeScreen /> },
  { pattern: '/admin/users', render: () => <UsersScreen /> },
  { pattern: '/admin/users/:id', render: (p) => <UserDetailScreen id={p.id} /> },
  { pattern: '/admin/content', render: () => <ContentScreen /> },
  { pattern: '/admin/content/:id', render: (p) => <CourseEditorScreen id={p.id} /> },
  { pattern: '/admin/templates', render: () => <TemplatesScreen /> },
  { pattern: '/admin/templates/:id', render: (p) => <TemplateEditorScreen id={p.id} /> },
  { pattern: '/admin/sets', render: () => <PracticeSetsScreen /> },
  { pattern: '/admin/sets/:id', render: (p) => <PracticeSetEditorScreen id={p.id} /> },
  { pattern: '/admin/questions', render: () => <QuestionsScreen /> },
  { pattern: '/admin/reports', render: () => <ReportsScreen /> },
  { pattern: '/admin/attempts/:id', render: (p) => <AdminAttemptScreen id={p.id} /> },
  { pattern: '/admin/videos', render: () => <AdminVideosScreen /> },
  { pattern: '/admin/videos/:id', render: (p) => <VideoEditorScreen id={p.id} /> },
  { pattern: '/admin/subjects', render: () => <ContentTreeScreen mode="subjects" /> },
  { pattern: '/admin/tree', render: () => <ContentTreeScreen /> },
  { pattern: '/admin/lessons/:id', render: (p) => <LessonEditorScreen id={p.id} /> },
  ...videoRoutes,
  ...learningRoutes,
];

const publicNav = [['/videos', 'Videos']];
const studentNav = [
  ['/', 'Dashboard'], ['/courses', 'Courses'], ['/practice', 'Practice'], ['/videos', 'Videos'], ['/history', 'History'],
];
// Administrators navigate with the left sidebar (AdminSidebar); the top bar links to the public site.
const adminNav = [['/videos', 'View videos']];

function Shell() {
  const { user, ready, logout } = useAuth();
  const path = usePath();
  const wide = useWindowDimensions().width >= 860;
  const isPublicPath = publicRoutes.some((r) => match(r.pattern, path));

  useEffect(() => {
    if (ready && !user && !isPublicPath) { rememberReturnPath(path); navigate('/login'); }
    if (ready && user && (path === '/login' || path === '/register')) navigate(takeReturnPath());
    // A teacher's home is the Math templates page.
    if (ready && user?.role === 'TEACHER' && path === '/') navigate('/admin/templates');
  }, [ready, user, path, isPublicPath]);

  if (!ready) return <Loading />;

  // Admins, teachers and supervisors all use the admin area; what each may do is enforced by the API.
  const isAdmin = isStaff(user?.role);
  const home = user?.role === 'TEACHER' ? '/admin/templates' : '/admin/tree';
  const routes = !user ? publicRoutes : isAdmin ? adminRoutes : studentRoutes;
  const nav = !user ? publicNav : isAdmin ? adminNav : studentNav;
  let content: ReactNode = null;
  for (const r of routes) {
    const params = match(r.pattern, path);
    if (params) {
      content = r.render(params);
      break;
    }
  }

  return (
    <View style={styles.app}>
      <View style={styles.bar} role="navigation">
        <View style={styles.barInner}>
          <Pressable onPress={() => navigate('/')} style={styles.brandRow} accessibilityLabel="MathTutor home">
            <Image source={{ uri: logo }} style={styles.logo} accessibilityLabel="Math Tutor" resizeMode="contain" />
          </Pressable>
          <View style={styles.nav}>
            {nav.map(([to, label]) => {
              const active = to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`);
              return (
                <Pressable key={to} onPress={() => navigate(to)}
                  style={({ hovered }: any) => [styles.navItem, (active || hovered) && styles.navActive]}>
                  <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.userBox}>
            {user ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.userText}>Hi, </Text>
                  {/* Name links to the user's home: admin console or student dashboard. */}
                  <Pressable onPress={() => navigate(isAdmin ? home : '/')} accessibilityRole="link"
                    accessibilityLabel={isAdmin ? 'Go to the admin page' : 'Go to your dashboard'}>
                    {({ hovered }: any) => (
                      <Text style={[styles.userText, styles.userLink, hovered && { textDecorationLine: 'underline' }]} numberOfLines={1}>
                        {user.fullName.split(' ')[0]}
                      </Text>
                    )}
                  </Pressable>
                </View>
                <Button small variant={path === '/account' ? 'primary' : 'ghost'} title="Account" onPress={() => navigate('/account')} />
                <Button small variant="secondary" title="Log out" onPress={logout} />
              </>
            ) : (
              <>
                <Button small variant="secondary" title="Log in" onPress={() => navigate('/login')} />
                <Button small title="Start free" onPress={() => navigate('/register')} />
              </>
            )}
          </View>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: isAdmin && wide ? 'row' : 'column' }}>
        {isAdmin && !/^\/(videos|courses|lessons)(\/|$)/.test(path) ? <AdminSidebar path={path} vertical={wide} /> : null}
        <View style={{ flex: 1, minWidth: 0 }} key={path}>
          {user?.role === 'SUPERVISOR' && isAdmin ? (
            <View style={styles.readOnly} role="status">
              <Text style={{ color: colors.ink2, fontSize: 13 }}>Read-only: as a supervisor you can view everything but not change it.</Text>
            </View>
          ) : null}
          <ErrorBoundary resetKey={path}>
          {content ?? (
            <View style={{ padding: space(10), alignItems: 'center' }}>
              <Text style={{ fontSize: 22, color: colors.ink3, fontFamily: fonts.serif }}>Page not found.</Text>
            </View>
          )}
          </ErrorBoundary>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  readOnly: { paddingHorizontal: space(6), paddingVertical: space(2), backgroundColor: colors.paper2, borderBottomWidth: 1, borderBottomColor: colors.line },
  app: { flex: 1, minHeight: '100%' as any, backgroundColor: colors.paper },
  bar: {
    position: 'sticky' as any, top: 0, zIndex: 1000,
    backgroundColor: 'rgba(251, 246, 238, 0.86)', ...({ backdropFilter: 'blur(12px)' } as any),
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  barInner: {
    width: '100%', maxWidth: 1180, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: space(4), paddingHorizontal: space(5), paddingVertical: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  // Logo artwork is 496 × 96 (2× for sharp screens): pics/math-tutor-logo-light-blue.png, trimmed.
  logo: { width: 155, height: 30 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, flex: 1, justifyContent: 'center' },
  navItem: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999 },
  navActive: { backgroundColor: colors.paper2 },
  navText: { color: colors.ink2, fontWeight: '500', fontSize: 13.5, fontFamily: fonts.sans },
  navTextActive: { color: colors.ink },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  userText: { color: colors.ink2, fontSize: 13.5, maxWidth: 200, fontFamily: fonts.sans },
  userLink: { color: colors.accentInk, fontWeight: '600' },
});
