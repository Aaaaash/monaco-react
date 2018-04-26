import flattenDeep from 'lodash/flattenDeep'
import zip from 'lodash/zip'

const addStyleRule = (function () {
  var added = {};
  var styleElement = document.createElement('style');
  document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
  var styleSheet = styleElement.sheet

  return function (css) {
    if (added[css]) { return; }
    added[css] = true;
    // styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length);
    styleElement.innerText += css
  };
}());

export {
  addStyleRule,
}

export function multiline (strings, ...keys) {
  const oStr = Array.isArray(strings) ? flattenDeep(zip(strings, keys)).join('') : strings
  const reIndent = /^[\ \t]+/
  let minIndentWidth = Infinity
  let minIndent = ''
  const oStrSplitted = oStr.split('\n')
  // discard first empty line
  if (oStrSplitted[0].replace(/\s*/g, '') === '') oStrSplitted.shift()
  return oStrSplitted.reduce((acc, str, idx) => {
    const matchOfIndent = reIndent.exec(str)
    const indent = matchOfIndent ? matchOfIndent[0] : ''
    if (indent.length !== str.length && indent.length < minIndentWidth) {
      minIndentWidth = indent.length
      minIndent = indent
    }
    acc.push(str)
    return acc
  }, []).map(str => str.replace(RegExp(`^${minIndent}`), '')).join('\n')
}
