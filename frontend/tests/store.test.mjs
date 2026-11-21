import test from 'node:test';
import assert from 'node:assert/strict';
const cache={};globalThis.localStorage={getItem:key=>cache[key]??null,setItem:(key,v)=>{cache[key]=v}};
const {state,update,posts,topics,addDraft,getDraft,deleteDraft,toggleOffline,isOffline} = await import('../src/store.js');
test('локальная библиотека отделена от публикаций PostgreSQL',()=>{
 assert.equal(posts().length, 0);
 assert.deepEqual(topics(), []);
 update(s=>s.saved.push(42));
 assert.ok(state().saved.includes(42));
});
test('черновик живёт отдельно',()=>{
 addDraft({id:'test-draft',title:'Тест',content:'контент'});
 assert.equal(getDraft('test-draft').title,'Тест');
 deleteDraft('test-draft');
 assert.equal(getDraft('test-draft'),null);
});
test('офлайн-подборка переключается',()=>{
 const post={id:9999,title:'Тест',content:'Текст',author:'А',tags:[],topic:'Наука'};
 assert.equal(toggleOffline(post),true);
 assert.equal(isOffline(post.id),true);
 assert.equal(toggleOffline(post),false);
 assert.equal(isOffline(post.id),false);
});
test('опубликованный серверный пост относится к автору, а не к demo customPosts', async () => {
 const {updateSession, rememberPost, isOwn} = await import('../src/store.js');
 const {selectedPosts} = await import('../src/pages/feed.js');
 updateSession({signedIn:true, user:{id:3, username:'tester'}, name:'tester'});
 const post = rememberPost({
   id:99, author_id:3, author_username:'tester', title:'Пост с сервера',
   summary:null, content_md:'# Текст', format:'article', cover_url:null,
   topic_ids:[], tag_names:[], parent_id:null, published_at:'2026-10-17T10:00:00Z',
   views_count:0,
 });
 assert.ok(isOwn(post));
 assert.ok(selectedPosts('mine').some(item=>item.id===99));
});
