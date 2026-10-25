import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../assets/preview.js',import.meta.url),'utf8');
test('standalone app retains all required planning workspaces',()=>{for(const name of ['sequence','unit','lesson','calendar']) assert.match(html,new RegExp('data-workspace="'+name+'"'));});
test('app markup preserves runtime element contracts',()=>{for(const id of ['application','workspace-content','workspace-label','workspace-purpose','course-counts','demo-back','demo-dialog','demo-status','customization-sample','year'])assert.ok(html.includes('id="'+id+'"'),id);for(const cssClass of ['example-question','sequence-strips'])assert.ok(html.includes(cssClass),cssClass);});
test('app is independent of site marketing and declares ephemeral data',()=>{assert.doesNotMatch(html,/id="how-it-works"|id="customization"|id="top"/);assert.match(html,/disappear on reload/);assert.match(html,/No account, cloud saving/);});
test('existing demo script supports shared records and scheduling preview',()=>{assert.match(js,/function createSampleCourse/);assert.match(js,/function renderCustomization/);assert.match(js,/function showSchedule/);});
