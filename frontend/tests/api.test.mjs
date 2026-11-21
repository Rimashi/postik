import test from 'node:test';
import assert from 'node:assert/strict';

test('API: JSON, cookie credentials, CSRF header for writes', async () => {
  const oldFetch = globalThis.fetch;
  const oldDocument = globalThis.document;
  const calls = [];
  globalThis.document = {cookie:'postik_csrf=test-csrf; theme=dark'};
  globalThis.fetch = async (url, options) => {
    calls.push({url, options});
    return new Response(JSON.stringify({id:7, title:'OK'}), {status:201,headers:{'content-type':'application/json'}});
  };
  try {
    const {request} = await import('../src/api/client.js');
    const value = await request('/posts', {method:'POST',body:{title:'OK'}});
    assert.equal(value.id,7);
    assert.equal(calls[0].url,'/api/v1/posts');
    assert.equal(calls[0].options.credentials,'include');
    assert.equal(calls[0].options.headers['X-CSRF-Token'],'test-csrf');
    assert.equal(JSON.parse(calls[0].options.body).title,'OK');
  } finally {globalThis.fetch = oldFetch;globalThis.document = oldDocument;}
});

test('API: HTTP error exposes status', async () => {
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:'Неверный пароль'}),{status:401,headers:{'content-type':'application/json'}});
  try {
    const {request}=await import('../src/api/client.js');
    await assert.rejects(()=>request('/auth/me'), e=>e.status===401 && e.message==='Неверный пароль');
  } finally {globalThis.fetch=oldFetch;}
});
