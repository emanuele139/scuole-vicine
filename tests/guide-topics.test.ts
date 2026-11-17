import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideTopics, questionTopics, topicsForGuide } from '../src/lib/guide-topics.ts';
const {guides}=JSON.parse(readFileSync(new URL('../src/data/guides.json',import.meta.url),'utf8'));
test('each published question is reachable through a topic and retains its age stage',()=>{
  for(const guide of guides){
    assert.ok(['nursery','preschool'].includes(guide.stage));
    const topics=topicsForGuide(guide);
    for(const question of guide.questions){
      assert.ok(questionTopics(guide.slug,question.id).length);
      for(const topic of questionTopics(guide.slug,question.id)){assert.ok(topics.includes(topic));assert.ok(guideTopics.some(item=>item.id===topic));}
    }
  }
  for(const topic of guideTopics)assert.ok(guides.some((guide:any)=>topicsForGuide(guide).includes(topic.id)));
});
test('mixed nursery guide sends admissions, visits and settling in to their relevant answers',()=>{
  assert.deepEqual(questionTopics('iscrizioni-visite-nido','attesa03'),['iscrizioni']);
  assert.deepEqual(questionTopics('iscrizioni-visite-nido','visite03'),['visite']);
  assert.deepEqual(questionTopics('iscrizioni-visite-nido','ambientamento03'),['ambientamento']);
});
