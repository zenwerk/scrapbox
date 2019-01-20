{
  // TODO: 現在のインデントレベルを保持して codeblock の範囲を判断するコード
  var indentLevel = 0;
}
/* 動作確認用 Scrapbox 記法
   ABC [** DEF] [http://example.com] ZZ
[[http://example.com [http://exaple.net]]]
AAAAA

*/

start = doc
doc = lines:line* {
  return {lines};
}

// TODO: もっと綺麗に組み合わせを書けるはず
line =
  // インデント任意 コンテンツ必須, 改行任意 (一般的なパターン)
  indent:indent contents:contents blankline:blankline? {
    const result = [indent, contents];
    if (blankline) { result.push(blankline); }
    return result;
  }
  // インデント必須, コンテンツ任意, 改行なし (ファイル末尾のパターン1)
  / indent:indent__ content:content? {
    const result = [indent];
    if (content) { result.push({type: 'contents', contents: [content] }); }
    return result;
  }
  // 改行のみ
  / blankline:blankline {
    return [
      {type: 'indent', level: 0},
      {type: 'contents', contents: [blankline] },
    ];
  }

indent = indent:_ {
  return {type: 'indent', level: indent.length};
}

indent__ = indent:__ {
  return {type: 'indent', level: indent.length};
}

contents = contents:content+ {
  return {type: 'contents', contents: contents};
}

content
  = backquote / bold / decoration / hash / shell / tex / link / quote / codeblock_header / table_header
  / text:nobackquote_chars { return {type: 'text', text: text}; } // 最後に自由入力

backquote = '`' text:$[^`\n\r]+ '`' { return {type: 'backquote', text: text}; }

// TODO: 閉じタグ ] を close:']'? のようにして return type を動的に変更できないか？
bold
  = '[[' _ contents:boldable+ _ ']]' {
    return {type: 'decoration', bold: 1, italic: false, strikethrough: false, underline: false, contents:contents};
  }

decoration
  = '[' deco:[-*/_]+ __ contents:boldable+ _ ']' {
    let bold = 0;
    let italic = false;
    let strikethrough = false;
    let underline = false;
    deco.forEach(ch => {
      if (ch === '*') { bold += 1; }
      if (ch === '/') { italic = true; }
      if (ch === '-') { strikethrough = true; }
      if (ch === '_') { underline = true; }
    })
    return {type: 'decoration', bold, italic, strikethrough, underline, contents};
  }

boldable
  = link:link _ { return link; }
  / text:chars_ _ { return {type: 'text', text: text}; }

link
  = url:url { return {type: 'link', url: url, text: url}; }
  / '[' _ url:url __ text:chars ']' { return {type: 'link', url: url, text: text}; }
  / '[' _ text:separated_text+ _ url:url _ ']' { return {type: 'link', url: url, text: text.join(' ')}; }
  / '[' _ url:url _ ']' { return {type: 'link', url: url, text: ''}; }
  / '[' _ text:chars _ ']' { return {type: 'link', url:text, text: text, internal: true}; } // scrapbox 内リンク
  // / '[' _ text:chars+ _ ']' { return {type: 'text', text: '[' + text.join(' ') + ']'}; }  // リンクではない
  // text:chars_ { return {type: 'text_3', text: text}; } // 最後に自由入力

separated_text
  = text:(chars_ __) { return text; }

hash = '#' text:chars_ {
  return {type: 'hash', text:text};
}

tex = '[$' __ text:chars ']' {
  return {type: 'tex', text: text};
}

quote = '>' _ text:chars_ {
  return {type: 'quote', text: text};
}

shell = '$' __ text:$[^\n\r]* {
  return {type: 'shell', text: text};
}

codeblock_header = 'code:' text:chars_ {
  return {type: 'codeblock', name: text};
}

table_header = 'table:' text:chars_ {
  return {type: 'table', name: text};
}

url = 'http' secure:'s'? '://' url:chars_ {
  return 'http' + (secure ? 's': '') + '://' + url;
}

text = t:chars_ {
  return t;
}

blankline = [\n] { return {type:'blank'}; }

chars = $[^\n\r\[\]]+
chars_ = $[^ 　\n\t\r\[\]]+
nobackquote_chars = $[^`\n\r\[\]]+

whitespace = [ 　\t]
_ = whitespace*
__ = whitespace+
