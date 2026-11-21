import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from '../src/router.js';
test('прямые ссылки',()=>{
  assert.deepEqual(resolve('/'),{page:'home'});
  assert.deepEqual(resolve('/posts'),{page:'feed'});
  assert.deepEqual(resolve('/posts/42'),{page:'article',id:'42'});
  assert.deepEqual(resolve('/users/rimashi'),{page:'profile',name:'rimashi'});
  assert.deepEqual(resolve('/editor'),{page:'editor'});
  assert.equal(resolve('/something').page,'notfound');
});
