import { Pressable, Text, View } from 'react-native';

import type { Attempt, ReviewSkill } from '../types';
import { navigate } from '../router';
import { colors, space } from '../theme';
import { MathInline, MathText } from './MathText';
import { Badge, Card, H2, Muted, Stat, Table } from './ui';
import { topicLabel } from '../screens/student/DashboardScreen';
import { Figure } from './web';

/** Finished-attempt summary: total, pass/fail, results by skill and each question with its answer. */
export default function AttemptReview({ attempt }: { attempt: Attempt }) {
  const correct = attempt.items.filter((i) => i.isCorrect).length;
  const pct = attempt.maxScore ? Math.round((100 * Number(attempt.score)) / Number(attempt.maxScore)) : 0;
  return (
    <View style={{ gap: space(4) }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Stat label="Score" value={`${Number(attempt.score)} / ${Number(attempt.maxScore)}`} />
        <Stat label="Points earned" value={`${pct}%`} />
        <Stat label="Questions correct" value={`${correct} / ${attempt.items.length}`} />
        <Card style={{ flexGrow: 1, flexBasis: 160, justifyContent: 'center' }}>
          <Badge tone={attempt.passed ? 'success' : 'danger'} text={attempt.passed ? 'Passed' : 'Not passed'} />
          <Muted style={{ marginTop: space(1) }}>Pass mark {Number(attempt.passPercent)}%{attempt.status === 'expired' ? ' · time expired' : ''}</Muted>
        </Card>
      </View>

      {attempt.review ? <ReviewCard review={attempt.review} passPercent={Number(attempt.passPercent)} /> : null}

      <Card>
        <H2>Results by skill</H2>
        <Table
          columns={[
            { key: 'topicCode', title: 'Skill', flex: 2, render: (r) => <Text>{topicLabel(r.topicCode)}</Text> },
            { key: 'correctQuestions', title: 'Correct' },
            { key: 'totalQuestions', title: 'Total' },
            { key: 'accuracyPercent', title: 'Accuracy', render: (r) => <Text>{Number(r.accuracyPercent)}%</Text> },
            { key: 'score', title: 'Points', render: (r) => <Text>{Number(r.score)} / {Number(r.maxScore)}</Text> },
          ]}
          rows={attempt.skills ?? []}
        />
      </Card>

      <Card>
        <H2>Questions</H2>
        <View style={{ gap: space(3) }}>
          {attempt.items.map((it) => {
            const chosen = it.options.find((o) => o.id === it.selectedOptionId);
            const right = it.options.find((o) => o.isCorrect);
            return (
              <View key={it.id} style={{ borderWidth: 1, borderColor: it.isCorrect ? '#b7e4c2' : '#f1c4c4', backgroundColor: it.isCorrect ? colors.successSoft : colors.dangerSoft, borderRadius: 10, padding: space(4), gap: space(2) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
                  <Muted>Question {it.position} · {topicLabel(it.topicCode)}</Muted>
                  <Text style={{ fontWeight: '700', color: it.isCorrect ? colors.success : colors.danger }}>
                    {it.isCorrect ? '✓' : '✗'} {Number(it.awardedPoints ?? 0)} / {Number(it.points)}
                  </Text>
                </View>
                <MathText source={it.promptLatex} size={17} />
                <Figure svg={it.figureSvg} maxWidth={360} />
                {it.answerMode === 'numeric' ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(5) }}>
                    <Muted>Your answer: <Text style={{ color: colors.text, fontWeight: '600' }}>{it.rawAnswer ?? '(no answer)'}</Text></Muted>
                    <Muted>Correct answer: <Text style={{ color: colors.text, fontWeight: '600' }}>{it.correctAnswer}</Text></Muted>
                  </View>
                ) : (
                  <View style={{ gap: space(1) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <Muted>Your answer:</Muted>{chosen ? <MathInline tex={chosen.latex} /> : <Muted>(no answer)</Muted>}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <Muted>Correct answer:</Muted>{right ? <MathInline tex={right.latex} /> : null}
                    </View>
                  </View>
                )}
                {it.explanation ? <MathText source={it.explanation} size={14} color={colors.muted} /> : null}
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

/** "What to review": one line per skill below the pass mark, pointing at the chapter / lesson to learn again. */
function ReviewCard({ review, passPercent }: { review: ReviewSkill[]; passPercent: number }) {
  if (!review.length) {
    return (
      <Card style={{ backgroundColor: colors.successSoft, borderColor: '#b7e4c2' }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Every skill reached {passPercent}% or more — nice work, no chapter to review.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, gap: space(3) }}>
      <H2>What to review</H2>
      {review.map((r) => {
        const skill = r.label || topicLabel(r.topicCode);
        const score = `${Number(r.accuracyPercent)}% (${Number(r.correctQuestions)} of ${Number(r.totalQuestions)} correct)`;
        return (
          <View key={r.topicCode} style={{ gap: space(1) }}>
            <Text style={{ color: colors.text, fontSize: 15 }}>
              You scored <Text style={{ fontWeight: '700' }}>{score}</Text> on <Text style={{ fontWeight: '700' }}>{skill}</Text>
              {r.lessons.length ? ' — learn this again:' : r.subjectName ? ` — review ${r.subjectName} before trying again.` : ' — review this skill before trying again.'}
            </Text>
            {r.lessons.map((l) => (
              <Pressable key={l.lessonId} onPress={() => navigate(`/lessons/${l.lessonId}`)} accessibilityRole="link" style={{ paddingLeft: space(4) }}>
                {({ hovered }: any) => (
                  <Text style={{ color: colors.link, textDecorationLine: hovered ? 'underline' : 'none' }}>
                    Chapter {l.chapterPosition} “{l.chapterTitle}” › Lesson {l.chapterPosition}.{l.lessonPosition} “{l.lessonTitle}”
                    <Text style={{ color: colors.muted }}> · {l.courseTitle}</Text>
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        );
      })}
    </Card>
  );
}
