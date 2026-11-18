import { mountFilmViewer } from './film-viewer.js';
import { mountAlbumRoll } from './album-roll.js';
import { works, articles, photos, albums, bookmarks } from './content.js';

const main = document.getElementById('main');
const icons = {
  arrow:'<path d="M5 19 19 5M5 5h14v14"/>',
  right:'<path d="m9 5 7 7-7 7"/>',
  left:'<path d="m15 5-7 7 7 7"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  moon:'<path d="M20.8 13a8.5 8.5 0 0 1-9.8-9.8A8.5 8.5 0 1 0 20.8 13Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const dateLabel = value => new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pageHead = (en, title, description, count, unit) => `<header class="page-head"><div><span class="eyebrow">${en}</span><h1 class="page-title">${title}</h1><p class="page-description">${description}</p></div>${count != null ? `<div class="page-number"><span>${String(count).padStart(2,'0')}</span>${unit}</div>` : ''}</header>`;
const backLink = (href, text) => `<a class="back-link" href="${href}">${icon('back')}<span>${text}</span></a>`;

function homePage() {
  return `<section class="page home"><div class="home-intro"><div class="hello-row"><img src="assets/avatar.svg" alt="头像占位插画" class="avatar" width="52" height="52"><div class="hello-meta"><span>A LITTLE CORNER OF THE INTERNET</span><span><i></i>一个不赶时间的个人空间</span></div></div><h1 class="home-title">你好，<br>欢迎来逛逛<span class="punctuation">。</span></h1><p class="home-desc">做一些有趣的东西，写下值得留住的想法。<br>也用照片，收藏日常里的微小瞬间。</p><div class="home-aside" aria-hidden="true"><span class="handwritten">Stay curious.<br>Take it slow.</span><span class="tiny-line"></span><small>CREATE SOMETHING.<br>NOTICE EVERYTHING.</small></div></div><div class="home-links">${[['works','SELECTED WORK','看作品'],['writing','WORDS & THOUGHTS','读文章'],['moments','PLACES & MOMENTS','逛相册'],['collection','THINGS WORTH KEEPING','翻收藏']].map(([href,en,cn])=>`<a class="home-link" href="#/${href}"><span class="en">${en}</span><span class="cn">${cn}</span>${icon('arrow')}</a>`).join('')}</div></section>`;
}

function workCover(work) {
  if(work.visual === 'colors') return '<div class="work-cover cover-color"><div class="palette-preview"><span style="background:#374238">#374238</span><span style="background:#68775c">#68775C</span><span style="background:#a7b294">#A7B294</span><span style="background:#d6d9c8;color:#6e7465">#D6D9C8</span><span style="background:#efece2;color:#76766b">#EFECE2</span></div><span class="cover-small-label">COLORS, COLLECTED.</span><span class="cover-mark">拾色 / 01</span></div>';
  return '<div class="work-cover cover-focus"><div class="timer-preview"><span>25:00</span><small>ONE THING AT A TIME</small></div><span class="cover-small-label">A MOMENT OF FOCUS.</span><span class="cover-mark">慢一点 / 02</span></div>';
}

function worksPage() {
  return `<section class="page">${pageHead('SELECTED WORK','一些小作品。','从一点好奇心开始，让想法慢慢变成可以触碰的东西。',works.length,'件作品')}<div class="works-grid">${works.map((w,index)=>`<article class="work-item reveal" style="--delay:${index*80}ms"><a class="work-visual" href="${w.href}" target="_blank" rel="noopener noreferrer" aria-label="体验${esc(w.title)}，在新标签页打开">${workCover(w)}</a><div class="work-info"><div class="work-title-row"><h2 class="work-title">${w.title}</h2><span class="small-note">${w.year}</span></div><p>${w.description}</p><div class="work-meta"><div class="work-tags">${w.tags.map(t=>`<span>${t}</span>`).join('<span>·</span>')}</div><a class="text-link" href="${w.href}" target="_blank" rel="noopener noreferrer">体验作品 ${icon('arrow')}</a></div></div></article>`).join('')}</div><div class="section-tail"><p class="small-note">这里先放了两件可体验的示例作品，留待你的创作慢慢填满。</p><span class="small-note">ALWAYS A WORK IN PROGRESS.</span></div></section>`;
}

function writingPage() {
  return `<section class="page writing-page">${pageHead('WORDS & THOUGHTS','写下来，记得住。','关于技术、创造，以及日常里值得停下来想一想的事。',articles.length,'篇文章')}<div class="writing-year">2026</div><div>${articles.map((a,index)=>`<a class="article-row reveal" style="--delay:${index*60}ms" href="#/writing/${a.slug}"><h2 class="article-title">${a.title}</h2><p class="article-excerpt">${a.summary}</p><div class="article-meta"><time datetime="${a.date}">${dateLabel(a.date)}</time><span class="meta-dot">·</span><span>${a.category}</span></div><span class="row-arrow">${icon('arrow')}</span></a>`).join('')}</div><div class="section-tail"><p class="small-note">先把想法留下，答案可以慢慢寻找。</p><span class="small-note">示例文章</span></div></section>`;
}

function articlePage(article) {
  const toc = article.sections.map(s=>`<a href="#section-${s.id}" data-section="section-${s.id}">${s.title}</a>`).join('');
  return `<article class="page article-detail">${backLink('#/writing','所有文章')}<header class="article-detail-head"><span class="eyebrow">${article.category} / NOTES</span><h1>${article.title}</h1><p class="article-excerpt">${article.summary}</p><div class="article-meta"><time datetime="${article.date}">${article.date.slice(0,4)} 年 ${dateLabel(article.date)}</time><span class="meta-dot">·</span><span>示例文章</span></div></header><details class="mobile-toc"><summary>本篇目录</summary><div>${toc}</div></details><div class="reading-layout"><div class="reading-body">${article.sections.map(s=>`<section id="section-${s.id}"><h2>${s.title}</h2>${s.html}${s.code ? `<div class="code-block"><div class="code-head"><span>${s.language}</span><button type="button" data-copy="${esc(s.code)}">${icon('copy')}<span>复制代码</span></button></div><pre><code><span class="code-key">${esc(s.code.split('\n')[0])}</span>\n${esc(s.code.split('\n').slice(1).join('\n'))}</code></pre></div>`:''}</section>`).join('')}</div><nav class="toc" aria-label="文章目录"><span class="eyebrow">ON THIS PAGE</span>${toc}</nav></div><div class="article-bottom">${backLink('#/writing','返回文章列表')}</div></article>`;
}

function momentsPage() {
  const cards = albums.map((album, index) => {
    const cover = photos[album.cover];
    return `<a class="album-card" draggable="false" href="#/moments/${album.slug}">
      <div class="album-cover">
        <img loading="${index < 4 ? 'eager' : 'lazy'}" src="${cover.src}" alt="${esc(cover.caption)}" width="${cover.width}" height="${cover.height}" draggable="false">
      </div>
      <div class="album-notes"><div class="album-caption"><h2>${esc(album.title)}</h2>${icon('arrow')}</div>
      <div class="album-meta">${esc(album.place)} · ${album.date} · ${album.images.length} 张照片</div></div>
    </a>`;
  }).join('');
  return `<section class="page album-index">
    <header class="album-index-head">
      <h1 class="page-title">走走，看看。</h1>
      <span class="small-note">${albums.length} 本相册</span>
    </header>
    <div class="album-roll">${cards}</div>
    <p class="small-note">示例影像来自 Unsplash。</p>
  </section>`;
}

function albumPage(album) {
  const first = photos[album.images[0]];
  if (!first) return `<section class="page">${backLink('#/moments','所有相册')}<h1>${esc(album.title)}</h1><p>相册里还没有照片。</p></section>`;
  return `<section class="page album-detail film-page">
    <header class="film-head">
      ${backLink('#/moments','所有相册')}
      <h1>${esc(album.title)}</h1>
      <span class="film-place">${esc(album.place)} · ${esc(album.date)}</span>
    </header>
    <figure class="film-viewer">
      <button class="film-gate" type="button" aria-label="放大第一张照片">
        <img src="${esc(first.src)}" alt="${esc(first.caption)}" draggable="false">
        <span class="film-shutter" aria-hidden="true"></span>
      </button>
      <figcaption class="film-foot">
        <p class="film-caption" aria-live="polite">${esc(first.caption)}</p>
        <div class="film-controls"${album.images.length < 2 ? ' hidden' : ''}>
          <button type="button" class="film-prev" aria-label="上一张照片">${icon('left')}</button>
          <span class="film-counter"></span>
          <button type="button" class="film-next" aria-label="下一张照片">${icon('right')}</button>
        </div>
      </figcaption>
    </figure>
  </section>`;
}

function bookmarkCards(kind='all') {
  return bookmarks.filter(b=>kind==='all'||b.kind===kind).map(b=>`<a class="bookmark" href="${b.href}" ${b.href.startsWith('https:')?'target="_blank" rel="noopener noreferrer"':''}><span class="bookmark-icon" aria-hidden="true">${b.mark}</span><div><h2>${b.title}</h2><p>${b.description}</p><div class="bookmark-meta"><span>${b.label}</span><span>·</span><span>${b.origin}</span></div></div>${icon('arrow')}</a>`).join('');
}

function collectionPage() {
  return `<section class="page collection-page">${pageHead('THINGS WORTH KEEPING','值得留住的。','好文章、好网站，还有一些慢慢整理的资料。',bookmarks.length,'个收藏')}<div class="collection-filters" role="group" aria-label="收藏类型">${[['all','全部'],['article','好文章'],['website','好网站'],['resource','资料笔记']].map(([id,label])=>`<button class="filter-button" type="button" data-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><div class="collection-grid" id="collection-grid">${bookmarkCards()}</div><div class="section-tail"><p class="small-note">示例收藏。比起存下链接，更想留下“为什么值得看”。</p><span class="small-note">A SMALL, PERSONAL LIBRARY.</span></div></section>`;
}

let scrollMemory = new Map();
let currentRoute = '';
let disposeAlbumRoll;
let filmViewer;
let renderToken = 0;
let revealObserver;
let tocObserver;
const routeName = () => {try{return decodeURIComponent(location.hash.slice(1) || '/')}catch{return '/'}};

function setupReveals() {
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('shown');revealObserver.unobserve(entry.target)}
  }),{threshold:.06,rootMargin:'0px 0px 20px 0px'});
  main.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
  tocObserver?.disconnect();
  const sections = main.querySelectorAll('.reading-body section');
  if(sections.length){
    tocObserver = new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){main.querySelectorAll('.toc a').forEach(a=>a.classList.toggle('active',a.dataset.section===entry.target.id))}}),{rootMargin:'-10% 0px -65% 0px'});
    sections.forEach(section=>tocObserver.observe(section));
  }
}

async function renderRoute(initial=false) {
  const token = ++renderToken;
  const route = routeName();
  if(currentRoute) scrollMemory.set(currentRoute, window.scrollY);
  if(!initial && !reduced()){
    main.classList.add('page-leaving');
    await new Promise(resolve=>setTimeout(resolve,150));
    if(token!==renderToken)return;
  }
  let content, title='慢慢 · 一个不赶时间的个人空间', section='home';
  const [, first, slug] = route.split('/');
  if(!first){content=homePage()}
  else if(first==='works'&&!slug){content=worksPage();section='works';title='作品 · 慢慢'}
  else if(first==='writing'){
    section='writing';
    const article=articles.find(a=>a.slug===slug);
    if(!slug){content=writingPage();title='文章 · 慢慢'}else if(article){content=articlePage(article);title=article.title+' · 慢慢'}
  }else if(first==='moments'){
    section='moments';
    const album=albums.find(a=>a.slug===slug);
    if(!slug){content=momentsPage();title='足迹 · 慢慢'}else if(album){content=albumPage(album);title=album.title+' · 慢慢'}
  }else if(first==='collection'&&!slug){content=collectionPage();section='collection';title='收藏 · 慢慢'}
  if(!content)content=`<section class="page not-found"><span class="eyebrow">A LITTLE DETOUR</span><h1>好像走远了一点。</h1><p>这个页面暂时还没有内容。</p><a class="pill-button" href="#/">回到首页 ${icon('arrow')}</a></section>`;
  disposeAlbumRoll?.();
  disposeAlbumRoll = undefined;
  filmViewer?.dispose();
  filmViewer = undefined;
  main.innerHTML=content;
  main.classList.remove('page-leaving');
  document.title=title;
  document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===section;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  currentRoute=route;
  window.scrollTo({top:scrollMemory.get(route)||0,behavior:'instant'});
  if(!initial)main.focus({preventScroll:true});
  setupReveals();
  const roll = main.querySelector('.album-roll');
  if (roll) disposeAlbumRoll = mountAlbumRoll(roll);
  const film = main.querySelector('.film-viewer');
  if (film) {
    const album = albums.find(a => a.slug === slug);
    filmViewer = mountFilmViewer(film, album.images.map(id => photos[id]), {
      enlarge: index => openLightbox(album, index), onError: toast
    });
  }
}
window.addEventListener('hashchange',()=>renderRoute());
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView({behavior:'instant',block:'start'})});

const themeButton=document.querySelector('.theme-toggle');
function updateThemeButton(){const dark=document.documentElement.dataset.theme==='dark';themeButton.innerHTML=icon(dark?'sun':'moon');themeButton.setAttribute('aria-label',dark?'切换到浅色模式':'切换到深色模式');document.querySelector('meta[name="theme-color"]').content=dark?'#1d201d':'#f7f6f2'}
themeButton.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('quiet-theme',next)}catch{}updateThemeButton()});
updateThemeButton();

let toastTimer;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2400)}

main.addEventListener('click',async event=>{
  const tocLink=event.target.closest('[data-section]');
  if(tocLink){event.preventDefault();document.getElementById(tocLink.dataset.section)?.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});return}
  const copyButton=event.target.closest('[data-copy]');
  if(copyButton){
    try{await navigator.clipboard.writeText(copyButton.dataset.copy);toast('代码已复制')}
    catch{const code=copyButton.closest('.code-block').querySelector('code');const range=document.createRange();range.selectNodeContents(code);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);toast('代码已选中，可手动复制')}
    return;
  }
  const filter=event.target.closest('[data-filter]');
  if(filter){main.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===filter)));const grid=document.getElementById('collection-grid');grid.innerHTML=bookmarkCards(filter.dataset.filter);main.querySelector('.page-number span').textContent=String(grid.children.length).padStart(2,'0');grid.classList.remove('filtering');void grid.offsetWidth;grid.classList.add('filtering');return}

});

const lightbox=document.getElementById('lightbox');
const lightboxImage=document.getElementById('lightbox-image');
let lightboxAlbum,lightboxIndex=0,lightboxReturnY=0,lightboxClosing=false;
lightbox.querySelector('.lightbox-close').innerHTML=icon('close');
lightbox.querySelector('.lightbox-prev').innerHTML=icon('left');
lightbox.querySelector('.lightbox-next').innerHTML=icon('right');
function updateLightbox(){
  const photo=photos[lightboxAlbum.images[lightboxIndex]];
  lightboxImage.src=photo.src;lightboxImage.alt=photo.caption;
  lightboxImage.style.animation='none';void lightboxImage.offsetWidth;lightboxImage.style.animation='';
  document.getElementById('lightbox-caption').innerHTML=`${photo.caption}<a href="${photo.source}" target="_blank" rel="noopener noreferrer">${photo.author==='Unsplash'?'图片来源':esc(photo.author)} / Unsplash ↗</a>`;
  document.getElementById('lightbox-count').textContent=`${String(lightboxIndex+1).padStart(2,'0')} / ${String(lightboxAlbum.images.length).padStart(2,'0')}`;
}
function openLightbox(album,index){
  if(!album)return;
  lightboxAlbum=album;lightboxIndex=index;lightboxReturnY=window.scrollY;lightboxClosing=false;
  updateLightbox();document.body.classList.add('modal-open');lightbox.showModal();requestAnimationFrame(()=>lightbox.classList.add('visible'));
}
function closeLightbox(){
  if(lightboxClosing||!lightbox.open)return;
  lightboxClosing=true;
  if (currentRoute === '/moments/' + lightboxAlbum.slug) filmViewer?.select(lightboxIndex);
  lightbox.classList.remove('visible');
  setTimeout(()=>{lightbox.close();document.body.classList.remove('modal-open');window.scrollTo({top:lightboxReturnY,behavior:'instant'});lightboxClosing=false},reduced()?0:230);
}
function nextPhoto(direction){lightboxIndex=(lightboxIndex+direction+lightboxAlbum.images.length)%lightboxAlbum.images.length;updateLightbox()}
lightbox.querySelector('.lightbox-close').addEventListener('click',closeLightbox);
lightbox.querySelector('.lightbox-prev').addEventListener('click',()=>nextPhoto(-1));
lightbox.querySelector('.lightbox-next').addEventListener('click',()=>nextPhoto(1));
lightbox.addEventListener('cancel',event=>{event.preventDefault();closeLightbox()});
lightbox.addEventListener('click',event=>{if(event.target===lightbox)closeLightbox()});
document.addEventListener('keydown',event=>{if(!lightbox.open)return;if(event.key==='ArrowRight'){event.preventDefault();nextPhoto(1)}else if(event.key==='ArrowLeft'){event.preventDefault();nextPhoto(-1)}});
let touchStart;
lightboxImage.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')touchStart={x:event.clientX,y:event.clientY}});
lightboxImage.addEventListener('pointerup',event=>{if(!touchStart)return;const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>45&&Math.abs(dy)<100)nextPhoto(dx<0?1:-1)});

const note=document.getElementById('note-dialog');
document.getElementById('demo-note').addEventListener('click',()=>note.showModal());
document.getElementById('close-note').addEventListener('click',()=>note.close());
note.addEventListener('click',event=>{if(event.target===note)note.close()});
renderRoute(true);
