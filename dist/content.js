export const works = [
  { id:'colors', title:'拾色', subtitle:'把喜欢的颜色，收进口袋。', description:'从自然与日常里拾取配色。一个简单的色彩灵感工具，点击就能带走喜欢的颜色。', tags:['小工具','交互实验'], href:'demos/colors.html', visual:'colors', year:'2026' },
  { id:'focus', title:'慢一点', subtitle:'给当下，一点完整的时间。', description:'一个安静的专注计时器。放下多余的界面，把接下来的二十五分钟留给一件事。', tags:['效率工具','极简设计'], href:'demos/focus.html', visual:'focus', year:'2026' }
];

export const articles = [
  { slug:'a-place-of-my-own', title:'做个人网站时，我想先解决的几件小事', summary:'从内容、阅读体验到持续更新，记录搭建一个个人空间时的一些取舍。', date:'2026-11-08', category:'网站开发', sections:[
    {id:'start', title:'先想清楚，想留下什么', html:'<p>开始做个人网站时，很容易先去选字体、配色和动效。但我更想先想清楚：这里准备留下哪些东西？</p><p>作品、文章、照片和收藏，各自适合不同的浏览方式。作品需要一张直观的封面，文章需要安静的阅读空间，照片则希望人愿意停下来多看一会儿。</p>'},
    {id:'reading', title:'给文字留一点空间', html:'<p>我希望文章页面尽量简单：标题清楚，段落舒展，代码和图片都能看得明白。排版的目标，是让读者把注意力留在内容上。</p><p>留白也属于内容的一部分。让一句话有停顿，让一段思考有呼吸的空间，阅读的节奏就会自然一些。</p>', code:'article {\n  max-width: 680px;\n  margin-inline: auto;\n  line-height: 1.9;\n}', language:'CSS'},
    {id:'publishing', title:'让更新成为一件小事', html:'<p>网站做完以后，更重要的是愿意继续使用它。写完一篇文章，或者整理完一次旅行的照片，最好都能很自然地发布出来。</p><p>比起一次放上很多内容，我更喜欢慢慢积累。今天记录一个发现，明天放上一组照片，时间会让这个空间变得有自己的样子。</p><blockquote>先把一个小而完整的版本做好，再让它随着内容慢慢生长。</blockquote>'}
  ]},
  { slug:'finding-the-slow-part', title:'一次接口变慢的排查记录', summary:'把一个模糊的“有点慢”，拆成可以观察、验证和逐步缩小范围的问题。', date:'2026-10-25', category:'问题排查', sections:[
    {id:'observe', title:'从一个具体的现象开始', html:'<p>遇到页面响应慢时，我想先把问题描述得更清楚：是在打开页面时，还是点击某个按钮后？每次都会出现，还是偶尔发生？</p><p>记录复现步骤，能让后续的观察围绕同一个问题展开。一个足够具体的问题，往往已经包含了下一步行动的线索。</p>'},
    {id:'separate', title:'把过程拆开观察', html:'<p>一次操作往往经过多个环节。我会沿着实际发生的顺序，把等待的位置逐个记下来，再选择最值得继续检查的部分。</p><p>这个过程里，我更愿意一次只改变一个因素，保留调整前后的记录。这样回头看时，可以知道哪一步真正改变了结果。</p>'},
    {id:'record', title:'留下过程，也留下边界', html:'<p>解决一个问题以后，我希望记录下当时观察到了什么、做了哪些改动，以及还有哪些地方没有验证。</p><blockquote>一篇排查记录，也可以是写给未来自己的路标。</blockquote><p>这是一篇展示阅读排版的示例文章，具体排查过程可以在以后替换成真实的实践记录。</p>'}
  ]},
  { slug:'small-tools', title:'把重复的小事，做成一个小工具', summary:'从一个每天都会遇到的小麻烦出发，聊聊怎样决定一个工具的第一版要做什么。', date:'2026-10-11', category:'开发记录', sections:[
    {id:'notice', title:'找到那个反复出现的动作', html:'<p>一些工具的起点很小：整理一批文件、转换一段文本，或者把分散的信息放在同一个地方。</p><p>我会先记下自己正在重复什么，再想象怎样的操作能让这件事变得更顺手。这个阶段不必着急添加功能，先描述一个具体的使用场景。</p>'},
    {id:'first', title:'让第一版有一条完整的流程', html:'<p>第一版只围绕一个具体场景：输入什么，经过哪些操作，最后得到什么结果。</p><p>界面可以很简单，但这条流程需要顺畅。真正开始使用以后，才更容易发现还缺少什么。</p>'},
    {id:'grow', title:'边用边调整', html:'<p>把工具放回日常生活里使用，是我判断下一步做什么的方式。频繁遇到的麻烦值得优先处理，很少用到的设想可以再等等。</p><blockquote>一件作品可以很小，只要它解决了一个真实的问题。</blockquote>'}
  ]}
];

export const photos = {
  'mist-lake':{src:'assets/mist-lake.jpg',width:1600,height:1205,caption:'雾慢慢落下来，山与湖交换了轮廓。',source:'https://unsplash.com/photos/fx-HYPFP99k',author:'Ivan Rohovchenko'},
  'snow-peak':{src:'assets/snow-peak.jpg',width:1600,height:1067,caption:'山顶还留着雪，水面已经安静下来。',source:'https://unsplash.com/photos/xk-zYQSopow',author:'Zak Bernadsky'},
  'forest-lake':{src:'assets/forest-lake.jpg',width:1600,height:2125,caption:'沿着岸边走，听见很轻的风。',source:'https://unsplash.com/photos/8fVmVlnrN5k',author:'Unsplash'},
  'quiet-water':{src:'assets/quiet-water.jpg',width:1600,height:1201,caption:'什么也不做，等一场雾散去。',source:'https://unsplash.com/photos/aM8XcigNdDg',author:'Unsplash'},
  'green-mountain':{src:'assets/green-mountain.jpg',width:1600,height:2400,caption:'把一些绿色，留在记忆里面。',source:'https://unsplash.com/photos/Mw3ZJ6c8Rn4',author:'Willi Nüchterlein'},
  'lake-stones':{src:'assets/lake-stones.jpg',width:1600,height:1068,caption:'走到水边，时间也跟着慢了下来。',source:'https://unsplash.com/s/photos/relaxing-nature',author:'Unsplash'}
};

export const albums = [
  {slug:'mountain-letters',title:'山有回声',place:'山间 · 影像手记',date:'2026.10',cover:'mist-lake',description:'把脚步放慢一点，风景就会多一点。\n这一组示例影像，收集了山、雾和水面之间安静的片刻。',images:['mist-lake','forest-lake','snow-peak','green-mountain','quiet-water','lake-stones']},
  {slug:'by-the-water',title:'等风，也等一场雾',place:'湖畔 · 片刻停留',date:'2026.09',cover:'quiet-water',description:'有时候，出发不需要很远的目的地。\n走到水边，坐一会儿，看云经过山顶，看光落在湖面。',images:['quiet-water','green-mountain','lake-stones','mist-lake']},
  {
    slug: 'evergreens', title: '林间的绿', place: '林线', date: '2026.08',
    cover: 'green-mountain', description: '这组示例照片从山坡的针叶林开始，沿着林线走向水边。',
    images: ['green-mountain', 'forest-lake', 'mist-lake']
  },
  {
    slug: 'snowline', title: '雪线之上', place: '山脊', date: '2026.07',
    cover: 'snow-peak', description: '在这组示例照片里，山顶的残雪和近处的岩石隔着一片湖水。',
    images: ['snow-peak', 'lake-stones', 'quiet-water']
  }
];

export const bookmarks = [
  {title:'一个记录“此刻”的页面',description:'关于如何用一个简单的页面，分享当下正在投入的事情。',kind:'article',label:'好文章',origin:'nownownow.com',href:'https://nownownow.com/about',mark:'n'},
  {title:'Astro',description:'围绕内容组织网站，让文章、作品与个人想法有一个自己的家。',kind:'website',label:'好网站',origin:'astro.build',href:'https://astro.build/',mark:'A'},
  {title:'个人网站设计笔记',description:'整理关于内容结构、阅读体验，以及持续更新的一些思考。',kind:'resource',label:'资料笔记',origin:'站内阅读',href:'#/writing/a-place-of-my-own',mark:'↗'},
  {title:'MDN · CSS 文档',description:'需要查一个样式属性，或者重新理解布局时，回来翻一翻。',kind:'resource',label:'参考资料',origin:'developer.mozilla.org',href:'https://developer.mozilla.org/zh-CN/docs/Web/CSS',mark:'M'},
  {title:'Unsplash',description:'看看不同地方的光影与构图，也为下一次出发积攒一点灵感。',kind:'website',label:'视觉灵感',origin:'unsplash.com',href:'https://unsplash.com/',mark:'U'},
  {title:'从一件小事开始',description:'记录一个想法怎样变成小工具，以及第一版可以怎样取舍。',kind:'article',label:'开发手记',origin:'站内阅读',href:'#/writing/small-tools',mark:'s'}
];
