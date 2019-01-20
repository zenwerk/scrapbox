const parser = (function() {
  "use strict";

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function peg$SyntaxError(message, expected, found, location) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.location = location;
    this.name     = "SyntaxError";

    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, peg$SyntaxError);
    }
  }

  peg$subclass(peg$SyntaxError, Error);

  peg$SyntaxError.buildMessage = function(expected, found) {
    var DESCRIBE_EXPECTATION_FNS = {
          literal: function(expectation) {
            return "\"" + literalEscape(expectation.text) + "\"";
          },

          "class": function(expectation) {
            var escapedParts = "",
                i;

            for (i = 0; i < expectation.parts.length; i++) {
              escapedParts += expectation.parts[i] instanceof Array
                ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
                : classEscape(expectation.parts[i]);
            }

            return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
          },

          any: function(expectation) {
            return "any character";
          },

          end: function(expectation) {
            return "end of input";
          },

          other: function(expectation) {
            return expectation.description;
          }
        };

    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }

    function literalEscape(s) {
      return s
        .replace(/\\/g, '\\\\')
        .replace(/"/g,  '\\"')
        .replace(/\0/g, '\\0')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
        .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
    }

    function classEscape(s) {
      return s
        .replace(/\\/g, '\\\\')
        .replace(/\]/g, '\\]')
        .replace(/\^/g, '\\^')
        .replace(/-/g,  '\\-')
        .replace(/\0/g, '\\0')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
        .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
    }

    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }

    function describeExpected(expected) {
      var descriptions = new Array(expected.length),
          i, j;

      for (i = 0; i < expected.length; i++) {
        descriptions[i] = describeExpectation(expected[i]);
      }

      descriptions.sort();

      if (descriptions.length > 0) {
        for (i = 1, j = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }

      switch (descriptions.length) {
        case 1:
          return descriptions[0];

        case 2:
          return descriptions[0] + " or " + descriptions[1];

        default:
          return descriptions.slice(0, -1).join(", ")
            + ", or "
            + descriptions[descriptions.length - 1];
      }
    }

    function describeFound(found) {
      return found ? "\"" + literalEscape(found) + "\"" : "end of input";
    }

    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  };

  function peg$parse(input, options) {
    options = options !== void 0 ? options : {};

    var peg$FAILED = {},

        peg$startRuleIndices = { start: 0 },
        peg$startRuleIndex   = 0,

        peg$consts = [
          function(lines) {
            return {lines};
          },
          function(indent, contents, blankline) {
              const result = [indent, contents];
              if (blankline) { result.push(blankline); }
              return result;
            },
          function(indent, content) {
              const result = [indent];
              if (content) { result.push({type: 'contents', contents: [content] }); }
              return result;
            },
          function(blankline) {
              return [
                {type: 'indent', level: 0},
                {type: 'contents', contents: [blankline] },
              ];
            },
          function(indent) {
            return {type: 'indent', level: indent.length};
          },
          function(contents) {
            return {type: 'contents', contents: contents};
          },
          function(text) { return {type: 'text', text: text}; },
          "`",
          peg$literalExpectation("`", false),
          /^[^`\n\r]/,
          peg$classExpectation(["`", "\n", "\r"], true, false),
          function(text) { return {type: 'backquote', text: text}; },
          "[[",
          peg$literalExpectation("[[", false),
          "]]",
          peg$literalExpectation("]]", false),
          function(contents) {
              return {type: 'decoration', bold: 1, italic: false, strikethrough: false, underline: false, contents:contents};
            },
          "[",
          peg$literalExpectation("[", false),
          /^[\-*\/_]/,
          peg$classExpectation(["-", "*", "/", "_"], false, false),
          "]",
          peg$literalExpectation("]", false),
          function(deco, contents) {
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
            },
          function(link) { return link; },
          function(url) { return {type: 'link', url: url, text: url}; },
          function(url, text) { return {type: 'link', url: url, text: text}; },
          function(text, url) { return {type: 'link', url: url, text: text.join(' ')}; },
          function(url) { return {type: 'link', url: url, text: ''}; },
          function(text) { return {type: 'link', url:text, text: text, internal: true}; },
          function(text) { return text; },
          "#",
          peg$literalExpectation("#", false),
          function(text) {
            return {type: 'hash', text:text};
          },
          "[$",
          peg$literalExpectation("[$", false),
          function(text) {
            return {type: 'tex', text: text};
          },
          ">",
          peg$literalExpectation(">", false),
          function(text) {
            return {type: 'quote', text: text};
          },
          "$",
          peg$literalExpectation("$", false),
          /^[^\n\r]/,
          peg$classExpectation(["\n", "\r"], true, false),
          function(text) {
            return {type: 'shell', text: text};
          },
          "code:",
          peg$literalExpectation("code:", false),
          function(text) {
            return {type: 'codeblock', name: text};
          },
          "table:",
          peg$literalExpectation("table:", false),
          function(text) {
            return {type: 'table', name: text};
          },
          "http",
          peg$literalExpectation("http", false),
          "s",
          peg$literalExpectation("s", false),
          "://",
          peg$literalExpectation("://", false),
          function(secure, url) {
            return 'http' + (secure ? 's': '') + '://' + url;
          },
          function(t) {
            return t;
          },
          /^[\n]/,
          peg$classExpectation(["\n"], false, false),
          function() { return {type:'blank'}; },
          /^[^\n\r[\]]/,
          peg$classExpectation(["\n", "\r", "[", "]"], true, false),
          /^[^ \u3000\n\t\r[\]]/,
          peg$classExpectation([" ", "\u3000", "\n", "\t", "\r", "[", "]"], true, false),
          /^[^`\n\r[\]]/,
          peg$classExpectation(["`", "\n", "\r", "[", "]"], true, false),
          /^[ \u3000\t]/,
          peg$classExpectation([" ", "\u3000", "\t"], false, false)
        ],

        peg$bytecode = [
          peg$decode(";!"),
          peg$decode("%$;\"0#*;\"&/' 8!: !! )"),
          peg$decode("%;#/A#;%/8$;5.\" &\"/*$8#:!##\"! )(#'#(\"'#&'#.S &%;$/7#;&.\" &\"/)$8\":\"\"\"! )(\"'#&'#./ &%;5/' 8!:#!! )"),
          peg$decode("%;:/' 8!:$!! )"),
          peg$decode("%;;/' 8!:$!! )"),
          peg$decode("%$;&/&#0#*;&&&&#/' 8!:%!! )"),
          peg$decode(";'.e &;(._ &;).Y &;-.S &;0.M &;..G &;+.A &;/.; &;1.5 &;2./ &%;8/' 8!:&!! )"),
          peg$decode("%2'\"\"6'7(/`#%$4)\"\"5!7*/,#0)*4)\"\"5!7*&&&#/\"!&,)/7$2'\"\"6'7(/($8#:+#!!)(#'#(\"'#&'#"),
          peg$decode("%2,\"\"6,7-/_#;:/V$$;*/&#0#*;*&&&#/@$;:/7$2.\"\"6.7//($8%:0%!\")(%'#($'#(#'#(\"'#&'#"),
          peg$decode("%21\"\"6172/\x82#$43\"\"5!74/,#0)*43\"\"5!74&&&#/`$;;/W$$;*/&#0#*;*&&&#/A$;:/8$25\"\"6576/)$8&:7&\"$\")(&'#(%'#($'#(#'#(\"'#&'#"),
          peg$decode("%;+/1#;:/($8\":8\"!!)(\"'#&'#.; &%;7/1#;:/($8\":&\"!!)(\"'#&'#"),
          peg$decode("%;3/' 8!:9!! ).\u015B &%21\"\"6172/\\#;:/S$;3/J$;;/A$;6/8$25\"\"6576/)$8&::&\"#!)(&'#(%'#($'#(#'#(\"'#&'#.\u010C &%21\"\"6172/r#;:/i$$;,/&#0#*;,&&&#/S$;:/J$;3/A$;:/8$25\"\"6576/)$8':;'\"$\")(''#(&'#(%'#($'#(#'#(\"'#&'#.\xA7 &%21\"\"6172/R#;:/I$;3/@$;:/7$25\"\"6576/($8%:<%!\")(%'#($'#(#'#(\"'#&'#.b &%21\"\"6172/R#;:/I$;6/@$;:/7$25\"\"6576/($8%:=%!\")(%'#($'#(#'#(\"'#&'#"),
          peg$decode("%%;7/,#;;/#$+\")(\"'#&'#/' 8!:>!! )"),
          peg$decode("%2?\"\"6?7@/1#;7/($8\":A\"! )(\"'#&'#"),
          peg$decode("%2B\"\"6B7C/I#;;/@$;6/7$25\"\"6576/($8$:D$!!)($'#(#'#(\"'#&'#"),
          peg$decode("%2E\"\"6E7F/:#;:/1$;7/($8#:G#! )(#'#(\"'#&'#"),
          peg$decode("%2H\"\"6H7I/T#;;/K$%$4J\"\"5!7K0)*4J\"\"5!7K&/\"!&,)/($8#:L#! )(#'#(\"'#&'#"),
          peg$decode("%2M\"\"6M7N/1#;7/($8\":O\"! )(\"'#&'#"),
          peg$decode("%2P\"\"6P7Q/1#;7/($8\":R\"! )(\"'#&'#"),
          peg$decode("%2S\"\"6S7T/U#2U\"\"6U7V.\" &\"/A$2W\"\"6W7X/2$;7/)$8$:Y$\"\" )($'#(#'#(\"'#&'#"),
          peg$decode("%;7/' 8!:Z!! )"),
          peg$decode("%4[\"\"5!7\\/& 8!:]! )"),
          peg$decode("%$4^\"\"5!7_/,#0)*4^\"\"5!7_&&&#/\"!&,)"),
          peg$decode("%$4`\"\"5!7a/,#0)*4`\"\"5!7a&&&#/\"!&,)"),
          peg$decode("%$4b\"\"5!7c/,#0)*4b\"\"5!7c&&&#/\"!&,)"),
          peg$decode("4d\"\"5!7e"),
          peg$decode("$;90#*;9&"),
          peg$decode("$;9/&#0#*;9&&&#")
        ],

        peg$currPos          = 0,
        peg$savedPos         = 0,
        peg$posDetailsCache  = [{ line: 1, column: 1 }],
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleIndices)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleIndex = peg$startRuleIndices[options.startRule];
    }

    function text() {
      return input.substring(peg$savedPos, peg$currPos);
    }

    function location() {
      return peg$computeLocation(peg$savedPos, peg$currPos);
    }

    function expected(description, location) {
      location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

      throw peg$buildStructuredError(
        [peg$otherExpectation(description)],
        input.substring(peg$savedPos, peg$currPos),
        location
      );
    }

    function error(message, location) {
      location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

      throw peg$buildSimpleError(message, location);
    }

    function peg$literalExpectation(text, ignoreCase) {
      return { type: "literal", text: text, ignoreCase: ignoreCase };
    }

    function peg$classExpectation(parts, inverted, ignoreCase) {
      return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
    }

    function peg$anyExpectation() {
      return { type: "any" };
    }

    function peg$endExpectation() {
      return { type: "end" };
    }

    function peg$otherExpectation(description) {
      return { type: "other", description: description };
    }

    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos], p;

      if (details) {
        return details;
      } else {
        p = pos - 1;
        while (!peg$posDetailsCache[p]) {
          p--;
        }

        details = peg$posDetailsCache[p];
        details = {
          line:   details.line,
          column: details.column
        };

        while (p < pos) {
          if (input.charCodeAt(p) === 10) {
            details.line++;
            details.column = 1;
          } else {
            details.column++;
          }

          p++;
        }

        peg$posDetailsCache[pos] = details;
        return details;
      }
    }

    function peg$computeLocation(startPos, endPos) {
      var startPosDetails = peg$computePosDetails(startPos),
          endPosDetails   = peg$computePosDetails(endPos);

      return {
        start: {
          offset: startPos,
          line:   startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line:   endPosDetails.line,
          column: endPosDetails.column
        }
      };
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildSimpleError(message, location) {
      return new peg$SyntaxError(message, null, null, location);
    }

    function peg$buildStructuredError(expected, found, location) {
      return new peg$SyntaxError(
        peg$SyntaxError.buildMessage(expected, found),
        expected,
        found,
        location
      );
    }

    function peg$decode(s) {
      var bc = new Array(s.length), i;

      for (i = 0; i < s.length; i++) {
        bc[i] = s.charCodeAt(i) - 32;
      }

      return bc;
    }

    function peg$parseRule(index) {
      var bc    = peg$bytecode[index],
          ip    = 0,
          ips   = [],
          end   = bc.length,
          ends  = [],
          stack = [],
          params, i;

      while (true) {
        while (ip < end) {
          switch (bc[ip]) {
            case 0:
              stack.push(peg$consts[bc[ip + 1]]);
              ip += 2;
              break;

            case 1:
              stack.push(void 0);
              ip++;
              break;

            case 2:
              stack.push(null);
              ip++;
              break;

            case 3:
              stack.push(peg$FAILED);
              ip++;
              break;

            case 4:
              stack.push([]);
              ip++;
              break;

            case 5:
              stack.push(peg$currPos);
              ip++;
              break;

            case 6:
              stack.pop();
              ip++;
              break;

            case 7:
              peg$currPos = stack.pop();
              ip++;
              break;

            case 8:
              stack.length -= bc[ip + 1];
              ip += 2;
              break;

            case 9:
              stack.splice(-2, 1);
              ip++;
              break;

            case 10:
              stack[stack.length - 2].push(stack.pop());
              ip++;
              break;

            case 11:
              stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));
              ip += 2;
              break;

            case 12:
              stack.push(input.substring(stack.pop(), peg$currPos));
              ip++;
              break;

            case 13:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1]) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 14:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1] === peg$FAILED) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 15:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1] !== peg$FAILED) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 16:
              if (stack[stack.length - 1] !== peg$FAILED) {
                ends.push(end);
                ips.push(ip);

                end = ip + 2 + bc[ip + 1];
                ip += 2;
              } else {
                ip += 2 + bc[ip + 1];
              }

              break;

            case 17:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (input.length > peg$currPos) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 18:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (input.substr(peg$currPos, peg$consts[bc[ip + 1]].length) === peg$consts[bc[ip + 1]]) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 19:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (input.substr(peg$currPos, peg$consts[bc[ip + 1]].length).toLowerCase() === peg$consts[bc[ip + 1]]) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 20:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (peg$consts[bc[ip + 1]].test(input.charAt(peg$currPos))) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 21:
              stack.push(input.substr(peg$currPos, bc[ip + 1]));
              peg$currPos += bc[ip + 1];
              ip += 2;
              break;

            case 22:
              stack.push(peg$consts[bc[ip + 1]]);
              peg$currPos += peg$consts[bc[ip + 1]].length;
              ip += 2;
              break;

            case 23:
              stack.push(peg$FAILED);
              if (peg$silentFails === 0) {
                peg$fail(peg$consts[bc[ip + 1]]);
              }
              ip += 2;
              break;

            case 24:
              peg$savedPos = stack[stack.length - 1 - bc[ip + 1]];
              ip += 2;
              break;

            case 25:
              peg$savedPos = peg$currPos;
              ip++;
              break;

            case 26:
              params = bc.slice(ip + 4, ip + 4 + bc[ip + 3]);
              for (i = 0; i < bc[ip + 3]; i++) {
                params[i] = stack[stack.length - 1 - params[i]];
              }

              stack.splice(
                stack.length - bc[ip + 2],
                bc[ip + 2],
                peg$consts[bc[ip + 1]].apply(null, params)
              );

              ip += 4 + bc[ip + 3];
              break;

            case 27:
              stack.push(peg$parseRule(bc[ip + 1]));
              ip += 2;
              break;

            case 28:
              peg$silentFails++;
              ip++;
              break;

            case 29:
              peg$silentFails--;
              ip++;
              break;

            default:
              throw new Error("Invalid opcode: " + bc[ip] + ".");
          }
        }

        if (ends.length > 0) {
          end = ends.pop();
          ip = ips.pop();
        } else {
          break;
        }
      }

      return stack[0];
    }


      // TODO: 現在のインデントレベルを保持して codeblock の範囲を判断するコード
      var indentLevel = 0;


    peg$result = peg$parseRule(peg$startRuleIndex);

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail(peg$endExpectation());
      }

      throw peg$buildStructuredError(
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length
          ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
          : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }

  return {
    SyntaxError: peg$SyntaxError,
    parse:       peg$parse
  };
})();
