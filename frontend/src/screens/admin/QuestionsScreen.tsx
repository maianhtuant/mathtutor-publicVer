import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '../../api';
import { MathText } from '../../components/MathText';
import { Button, Card, Checkbox, ErrorBox, Field, H2, Muted, Notice, Screen } from '../../components/ui';
import { useAction, useApi } from '../../hooks';
import { colors, space } from '../../theme';

const blank = () => ({ topicCode: '', prompt: '', explanation: '', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] });

export default function QuestionsScreen() {
  const { data, error, reload } = useApi<any[]>('/admin/questions');
  const [q, setQ] = useState(blank());
  const action = useAction();

  const create = () => action.run(async () => {
    await api.post('/admin/questions', { ...q, options: q.options.filter((o) => o.text.trim()) });
    setQ(blank());
    reload();
  }, 'Question added to the bank');

  const setOption = (i: number, patch: any) => setQ({
    ...q,
    options: q.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.isCorrect ? { ...o, isCorrect: false } : o)),
  });

  return (
    <Screen title="Question bank" subtitle="Fixed multiple-choice questions that can be added to practice sets">
      <ErrorBox message={error || action.error} />
      <Notice message={action.notice} />
      <Card>
        <H2>New question</H2>
        <Field label="Topic code" value={q.topicCode} onChangeText={(topicCode) => setQ({ ...q, topicCode })} autoCapitalize="none" placeholder="general" />
        <Field label="Question (text with $LaTeX$)" multiline value={q.prompt} onChangeText={(prompt) => setQ({ ...q, prompt })} />
        {q.prompt ? <Card style={{ backgroundColor: colors.bg, marginBottom: space(3) }}><MathText source={q.prompt} /></Card> : null}
        {q.options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), flexWrap: 'wrap' }}>
            <Field label={`Option ${String.fromCharCode(65 + i)}`} value={o.text} onChangeText={(text) => setOption(i, { text })} style={{ flexBasis: 280 }} />
            <Checkbox label="Correct" value={o.isCorrect} onChange={() => setOption(i, { isCorrect: true })} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: space(2), marginBottom: space(3) }}>
          {q.options.length < 8 ? <Button small variant="ghost" title="+ Option" onPress={() => setQ({ ...q, options: [...q.options, { text: '', isCorrect: false }] })} /> : null}
          {q.options.length > 2 ? <Button small variant="ghost" title="− Option" onPress={() => setQ({ ...q, options: q.options.slice(0, -1) })} /> : null}
        </View>
        <Field label="Explanation (shown after submission)" multiline value={q.explanation} onChangeText={(explanation) => setQ({ ...q, explanation })} />
        <View style={{ flexDirection: 'row' }}>
          <Button title="Add question" onPress={create} loading={action.busy}
            disabled={!q.prompt.trim() || q.options.filter((o) => o.text.trim()).length < 2 || !q.options.some((o) => o.isCorrect && o.text.trim())} />
        </View>
      </Card>
      {(data ?? []).map((b) => (
        <Card key={b.id}>
          <Muted style={{ fontSize: 12, marginBottom: space(1) }}>{b.topicCode}</Muted>
          <MathText source={b.prompt} />
          <View style={{ marginTop: space(2), gap: space(1) }}>
            {b.options.map((o: any) => (
              <Text key={o.id} style={{ color: o.isCorrect ? colors.success : colors.text, fontWeight: o.isCorrect ? '700' : '400' }}>
                {String.fromCharCode(64 + o.position)}. {o.text}{o.isCorrect ? '  ✓' : ''}
              </Text>
            ))}
          </View>
        </Card>
      ))}
      {data && data.length === 0 ? <Muted>The question bank is empty.</Muted> : null}
    </Screen>
  );
}
