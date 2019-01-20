//import parser from './parser';
// import './style.css';

const SCRAPBOX_DOMAIN = 'scrapbox.io';
const REFERENCE_PROJECT = 'ref';

// TODO: グローバル変数での状態管理をやめる
let PROJECT_NAME = '';
let CURRENT_INDENT_LEVEL = 0;
let IN_CODEBLOCK = false;     // 現在コードブロックの中か？
let DO_CODEBLOCK_ESCAPE_PROCESS = false; // コードブロックの閉じタグ処理を行うためのフラグ
// let EMPTY_LINKS = [];

const INDENT = 'indent';
const CONTENTS = 'contents';
const LINK = 'link';
const DECORATION = 'decoration';
const BACKQUOTE = 'backquote';
const TEXT = 'text';
const HASH = 'hash';
const QUOTE = 'quote';
const TEX = 'tex';
const SHELL = 'shell';
const CODEBLOCK = 'codeblock';
const TABLE = 'table';
const BLANK = 'blank';

// Scrapbox のプロジェクト名をURLから探して返す
const getProjectName = () => {
  const r = window.location.href.match(/scrapbox\.io\/([^/.]*)/) || window.location.href.match(/localhost:\d+\/([^/.]*)/);
  if (r && r.length >= 2) {
    return encodeURIComponent(r[1]);
  }
  return 'zenwerk';
};

const getScrapboxUrl = url => (
  'https://scrapbox.io' + url
);

const getDomain = url => {
  const a = document.createElement('a');
  a.href = url;
  return a.hostname;
};

const getPathname = url => {
  const a = document.createElement('a');
  a.href = url;
  return a.pathname;
};


const copyToClipboard = text => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("Copy");
  textarea.parentElement.removeChild(textarea);
};

// テキスト一文字ずつ <span> で囲む処理
const spans = (txt, index = 0) => {
  let body = '';
  for (let k = 0; k < txt.length; k++) {
    body += `<span class="c-${index}">${txt[k]}</span>`;
    index++;
  }
  return body;
};

const encodeHref = (url, startsWithHttp) => {
  const tt = url.match(/scrapbox\.io\/([^/]+)\/(.+)/);
  if (startsWithHttp || tt === null) {
    url = url.replace(/</gi, '%3C').replace(/>/gi, '%3E').replace(/;/gi, '%3B');
    return url;
  }
  let pageName = tt[2];
  const pageRowNum = pageName.match(/#.{24,32}$/);
  if (pageRowNum) {
    // 行リンク
    const n = pageRowNum[0];
    pageName = encodeURIComponent(pageName.split(n)[0]) + n;
  } else {
    pageName = encodeURIComponent(pageName);
  }
  return url.replace(tt[2], pageName);
};

// 画像になる可能性があるものをimgタグにして返す
const makeImageTag = (href) => {
  href = href.trim();
  let imgTag = '';
  let isImg = true;
  if (href.match(/\.icon\**\d*$/gi)) {
    // scrapbox の icon 対応
    let iconName = href.split('.icon')[0];
    if (iconName.charAt(0) !== '/') {
      iconName = '/' + PROJECT_NAME + '/' + iconName;
    }
    const tokens = href.split('*');
    let times = 1;
    if (tokens.length === 2) {
      times = +tokens[1];
    }
    for (let i = 0; i < times; i++) {
      imgTag += `<img class="popup-tiny-icon" src="https://scrapbox.io/api/pages${iconName}/icon">`;
    }
  } else if (href.endsWith('.jpg') || href.endsWith('.png') || href.endsWith('.gif')) {
    imgTag = `<img class="popup-small-img" src="${href}">`;
  } else if (href.match(/^https{0,1}:\/\/gyazo.com\/.{24,32}$/)) {
    imgTag = `<img class="popup-small-img" src="${href}/raw">`;
  } else {
    imgTag = href;
    isImg = false;
  }
  return [imgTag, isImg];
};

// Shell記法
const makeShellTag = (elm) => (
  `<code class="cli">
<span class="prefix"><span class="c-0">$</span></span>
<span class="c-1"> </span>
<span class="command">
${spans(elm.text, 2)}
</span>
</code>`
);

// 引用符で挟まれたコード
const makeBackQuoteTag = elm => (
  `<code class="code"><span class="popup-backquote">${spans(elm.text)}</span></code>`
);


// 引用タグ
const makeQuoteTag = elm => (
  `<span class="popup-quote">${spans(elm.text)}</span>`
);

// 装飾処理など
const makeDecorationTag = (elm) => {
  let html = '';
  elm.contents.forEach(content => {
    html += decorate(content);
  });
  if (elm.underline) {
    html = `<span class="popup-underline">${html}</span>`;
  }
  if (elm.italic) {
    html = `<i>${html}</i>`;
  }
  if (elm.strikethrough) {
    html = `<s>${html}</s>`;
  }
  if (elm.bold) {
    html = `<b>${html}</b>`;
  }
  return html;
};

const makeLinkTag = (elm) => {
  let body = elm.text;
  let href = elm.url;
  const [imgTag, isImg] = makeImageTag(href);
  if (isImg) {
    body = imgTag;
  } else {
    body = spans(body);
  }
  return `<a href="${encodeHref(href, true)}" class="popup-ref-link" target="_blank">${body}</a>`;
};

const makeInternalLinkTag = (elm) => {
  // let classEmptyLink = '';
  // if (EMPTY_LINKS.indexOf(body) !== -1) classEmptyLink = 'empty-page-link';
  const target = (PROJECT_NAME !== getProjectName()) ? '_blank' : '_self';
  let href = '';
  if (elm.text.indexOf('http') !== -1) {
    href = getPathname(elm.url)
  } else if (elm.text.charAt(0) === '/') {
    href = elm.text;
  }
  return `<a href="${encodeHref(getScrapboxUrl(href), false)}" class="page-link" target="${target}">${spans(elm.text)}</a>`;
};

const makeHashLinkTag = (elm) => {
  const keyword = encodeURIComponent(elm.text);
  const target = (PROJECT_NAME !== getProjectName()) ? '_blank' : '_self';
  return `<a href="/${PROJECT_NAME}/${keyword}" class="page-link" target="${target}">${spans(elm.text)}</a>`;
};

const makeCodeStartTag = (elm, state) => (
  `<span class="popup-code-block">
<a href="/api/code/${state.projectName}/${state.title}/${elm.name}" target="_blank"><span class="popup-code-block-start">${elm.name}</span></a>
<button class="popup-code-copy-button">copy</button>
<span class="popup-code">`
);

const decorate = (elm, state) => {
  switch (elm.type) {
    case INDENT:
      // codeblockはcodeblockの開始タグ + 1 レベル深いインデント以上なら継続する
      if (IN_CODEBLOCK && CURRENT_INDENT_LEVEL + 1 > elm.level) {
        IN_CODEBLOCK = false;
        DO_CODEBLOCK_ESCAPE_PROCESS = true; // 閉じタグを追加する
      }
      CURRENT_INDENT_LEVEL = elm.level;
      // インデント1階層につき半角スペース2個分あける
      return '&nbsp;&nbsp;'.repeat(elm.level);
    case LINK:
      // TODO: リンク処理
      if (elm.internal || getDomain(elm.url) === SCRAPBOX_DOMAIN) {
        return makeInternalLinkTag(elm);
      }
      return makeLinkTag(elm);
    case DECORATION:
      // 文字装飾
      return makeDecorationTag(elm);
    case BACKQUOTE:
      // 行コード
      return makeBackQuoteTag(elm);
    case TEXT:
      // 自由入力テキスト
      if (DO_CODEBLOCK_ESCAPE_PROCESS) {
        DO_CODEBLOCK_ESCAPE_PROCESS = false;
        return `${elm.text}</span></span>`;
      }
      return elm.text;
    case HASH:
      // TODO: ハッシュリンク処理
      return makeHashLinkTag(elm);
    case QUOTE:
      // TODO: 引用処理
      return makeQuoteTag(elm);
    case TEX:
      // TODO: 数式処理
      return elm.text;
    case SHELL:
      // シェル記法
      return makeShellTag(elm);
    case CODEBLOCK:
      // コードブロック処理開始
      IN_CODEBLOCK = true;
      return makeCodeStartTag(elm, state);
    case TABLE:
      // TODO: テーブル表記処理
      return elm.name;
    case BLANK:
      // 改行処理
      return '<br />';
    case CONTENTS:
      // コンテンツ処理(再帰処理)
      let html = '';
      elm.contents.forEach(elm => {
        html += decorate(elm, state);
      });
      return html;
    default:
      console.warn(`unknown result type: ${elm.type}`);
  }
  return '';
};


// process は parser の結果から html を生成して返す
const process = (result, state) => {
  let html = '';

  result.lines.forEach(line => {
    // TODO: パーサーのできが悪くnullが含まれる場合があるため確認する
    if (!line) { return; }
    // TODO: パーサーの返り値が統一されていないためオブジェクトか逐次確認する
    if (line.type && !Array.isArray(line)) {
      html += decorate(line, state);
    } else {
      line.forEach(elm => {
        html += decorate(elm, state);
      });
    }
  });

  return html;
};


/* ================ */
/*  表示コントール    */
/* ================ */
const previewPageText = (page, popup, title, lineHash, emptyLink, category) => {
  let extraClassName = '';
  const isExternalProject = PROJECT_NAME !== getProjectName();

  let url = `https://scrapbox.io/api/pages/${PROJECT_NAME}/${title}`;
  if (emptyLink) {
    if (category) {
      title = `${category}%2F${title}`;
    }
    url = `https://scrapbox.io/api/pages/${REFERENCE_PROJECT}/${title}`;
  }

  $.ajax({
    type: 'GET',
    contentType: 'application/json',
    url,
  }).done(data => {
    // EMPTY_LINKS = data.emptyLinks || [];
    if (isExternalProject) {
      popup.addClass('popup-external-project');
    }
    popup.attr('data-project', PROJECT_NAME);

    // ここでDOM要素にポップアップを追加する
    page.append(popup);

    const lines = data.lines;
    const contents = [];
    const state = {title: data.title, projectName: PROJECT_NAME};
    let result;
    let html = '';
    for (let l = 1; l < lines.length; l++) {
      const line = lines[l];
      if (!line.text) {
        contents.push('');
        continue;
      }
      try {
        result = parser.parse(line.text);
      } catch (e) {
        // ParseError
        console.warn(e);
        continue;
      }
      if (result && result.lines) {
        console.log(result.lines); // TODO: あとで消す
        html = process(result, state);
        contents.push(html);
      }
      if (lineHash && line.id === lineHash) {
        extraClassName = 'popup-line-permalink';
        break
      }
    }
    // popup を表示する
    if (contents.length > 0) {
      popup.html(`<div class="${extraClassName}"><h5 class="popup-title">${data.title}</h5>${contents.join('<br />')}</div>`);
      popup.show();
    }
  });
};

const eliminateHashes = (title, projectName) => {
  title = title.replace(/^#/, '');  // 先頭のハッシュタグ記号があれば取り除く

  // エディタ左側をクリックしたときにURLに付与されるラインハッシュ(テロメア)の処理
  let match = title.match(/#.{24,32}$/);  // 先頭#で始まる24~34文字の文字列が含まれているか？
  let lineHash = null;
  if (match !== null) {
    title = title.replace(/#.{24,32}$/, '');  // 含まれていたらtitleから消す
    lineHash = match[0].replace('#', '');  // ハッシュの先頭の`#`を削除
  }

  if (title.startsWith('/')) {
    // 外部プロジェクト名とページ名を抽出
    let tt = title.match(/\/([^\/]+)\/(.+)/);
    if (!tt) return {title: '', lineHash: ''};
    projectName = tt[1];
    title = tt[2];
    // console.log('title startsWith "/"', title, lineHash, projectName);
  }
  title = encodeURIComponent(title);
  // TODO: グローバル変数依存をなくす
  PROJECT_NAME = projectName;  // プロジェクト名(グローバル変数)の書き換え

  return {
    title,
    lineHash,
  };
};


// 拡張機能の起点となるイベントリスナの登録はここ
export const enablePopup = () => {
  const root = $('#app-container');  // <body>の直下にあるのは $appRoot
  let timer = null;

  root.on('mouseenter', 'a.page-link', (e) => {
    let aTag = $(e.target).closest('a.page-link');  // 起点となっている <a>
    let parent = $(e.target).closest('div.text-popup');  // 親ポップアップ
    let page = root.find('.page');  // page は Scrapbox のエディタ部分(白背景)
    let emptyLink = false;

    // 空リンクは ref を参照する
    let category = '';
    if (aTag.hasClass('empty-page-link')) {
      emptyLink = true;
      const tags = $('a[type="hashTag"]');
      if (tags && tags.length) {
        category = tags[0].innerText.substr(1);
      }
    }

    // ポップアップの雛形エレメントの用意
    let popup = $(`<div class="popup-text-bubble related-page-list popup-card popup-card-root"></div>`);

    // マウスオーバーしている <a> のCSSボーダーボックスを取得する(x, y には現在座標が入っている)
    let rect = aTag[0].getBoundingClientRect();

    // ポップアップのデザイン
    popup.css({
      'max-width': $('.editor')[0].offsetWidth - aTag[0].offsetLeft,
      'left': rect.left + window.pageXOffset,
      'top': 18 + rect.top + window.pageYOffset + aTag[0].offsetHeight + 3 - 24,
      'border-color': $('body').css('background-color')
    });
    // 表示位置の取得
    let pos = `${popup.css('top')}_${popup.css('left')}`;
    popup.attr('data-pos', pos);

    // すでに表示されているならば, 何もしない
    if ($(`.text-popup[data-pos="${pos}"]`).length > 0) {
      return;
    }
    if (aTag.attr('rel') && aTag.attr('rel') === 'route') {
      $(`.text-popup:not([data-pos="${pos}"])`).remove();
    }

    // キーワード先のテキストを取得する
    let keyword = aTag[0].innerText;  // タグ名を取得
    timer = setTimeout(() => {
      // 親ポップアップがあったらScrapboxプロジェクト名は親から取得する
      let projectName = parent.length > 0 ? parent.attr('data-project') : getProjectName();
      const title = eliminateHashes(keyword.trim(), projectName);

      previewPageText(page, popup, title.title, title.lineHash, emptyLink, category);
    }, 650);
  });

  root.on('click', 'button.popup-code-copy-button', e => {
    const text = $($(e.target)[0].parentElement).find('span.popup-code')[0].innerText;
    copyToClipboard(text);
  });

  // イベントリスナーの登録
  root.on('mouseleave', 'a.page-link', (e) => {
    clearTimeout(timer);
  });
  root.on('mouseleave', '.popup-card', (e) => {
    clearTimeout(timer);
  });
  root.on('click', (e) => {
    clearTimeout(timer);
    let popup = $('.popup-card');
    let t = $(e.target).closest('.popup-card');
    if ($(e.target)[0].tagName.toLowerCase() === 'a') {
      popup.remove();
    } else if (t.length > 0) {
      //t.remove();
    } else {
      popup.remove();
    }
  })
};

enablePopup();
