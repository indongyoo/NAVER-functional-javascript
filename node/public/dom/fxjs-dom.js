// FxJS-DOM 0.0.12
import {
  isUndefined, isArray, isString,
  head,
  curry, go, pipe, tap,
  each, map,
  defaults,
  L
} from "./fx.js";

const $ = sel => document.querySelector(sel);

$.all = sel => document.querySelectorAll(sel);
export default $;

const idCreator = _ => {
  var i = 0;
  return _ => 'fxdom-id-' + i++;
};

const createId = idCreator();

const baseFind = qs => curry((sel, el) => {
  const id = el.id;
  el.id = id || createId();
  const res = el[qs]('#' + el.id + (sel[0] == '&' ? sel.substr(1) : ' ' + sel));
  if (!id) el.removeAttribute('id');
  return res;
});

$.find = baseFind('querySelector');

$.findAll = baseFind('querySelectorAll');

$.children = el => el.children;

$.closest = curry((sel, el) => el.closest(sel));

const isEl = node =>
  node && typeof node == 'object' && (node.nodeType == 1 || node.nodeType == 9);

const nextOrPrevAll = (k, add) => function f(sel, el) {
  if (arguments.length == 1) {
    if (typeof sel == 'string') return el => f(sel, el);
    el = sel;
    sel = '*';
  }
  let res = [], cur = el;
  while ((cur = cur[k])) if (isEl(cur) && $.is(sel, cur)) res[add](cur);
  return res;
};

$.prevAll = nextOrPrevAll('previousSibling', 'unshift');
$.nextAll = nextOrPrevAll('nextSibling', 'push');

const nextOrPrev = k => function f(sel, el) {
  if (arguments.length == 1) {
    if (typeof sel == 'string') return el => f(sel, el);
    el = sel;
    sel = '*';
  }
  let cur = el;
  while ((cur = cur[k]) && (!isEl(cur) || !$.is(sel, cur))) {}
  return cur;
};

$.prev = nextOrPrev('previousSibling');
$.next = nextOrPrev('nextSibling');

const docEl = document.documentElement;
const matches = docEl.matches || docEl.webkitMatchesSelector || docEl.mozMatchesSelector || docEl.msMatchesSelector;

$.is = curry((sel, el) => el && matches.call(el, sel));

$.contains = curry((parent, child) => parent.contains(child));

const
  fragmentRE = /^\s*<(\w+|!)[^>]*>/,
  table = document.createElement('table'),
  tableRow = document.createElement('tr'),
  div = document.createElement('div'),
  containers = {
    'tr': document.createElement('tbody'),
    'tbody': table, 'thead': table, 'tfoot': table,
    'td': tableRow, 'th': tableRow
  };

$.els = html => {
  html = html.trim();
  const name = fragmentRE.test(html) && RegExp.$1;
  const container = containers[name] || div;
  container.innerHTML = html;
  return each($.remove, [...container.childNodes]);
};

$.el = html => {
  html = html.trim();
  return html[0] == '<' ? head($.els(html)) : document.createElement(html);
};

$.append = curry((parent, child) => parent.appendChild(child));

$.prepend = curry((parent, child) => parent.insertBefore(child, parent.firstChild));

$.before = curry((after, before) => after.parentNode.insertBefore(before, after));

$.after = curry((before, after) =>
  before.nextSibling ? $.before(before.nextSibling, after) : $.append(before.parentNode, after));

$.remove = el => el.parentNode.removeChild(el);

$.text = el => el.textContent;

$.setText = $.set_text = curry((text, el) => (el.textContent = text, el));

$.html = el => el.innerHTML;

$.setHtml = $.set_html = curry((html, el) => (el.innerHTML = html, el));

$.outerHTML = el => el.outerHTML;

$.setOuterHTML = $.set_outer_html = curry((html, el) => el.outerHTML = html);

$.val = el => el.value;

$.setVal = $.set_val = curry((value, el) => (el.value = value, el));

$.attr = curry((k, el) => el.getAttribute(k));

$.setAttr = $.set_attr = curry((kv, el) => (
  isArray(kv) ?
    el.setAttribute(...kv) :
    each(kv => el.setAttribute(...kv), L.entries(kv)), el));

$.removeAttr = $.remove_attr = curry((k, el) => (el.removeAttribute(k), el));

var methodClass = method => curry((class_names, el) => (
  each(cn => el.classList[method](cn), class_names.split(' ')), el
));

$.addClass = $.add_class = methodClass('add');
$.removeClass = $.remove_class = methodClass('remove');
$.toggleClass = $.toggle_class = methodClass('toggle');

function baseScroll(el, val, prop, method) {
  el = el || window;
  var top = prop == "pageYOffset";
  var win = el == window || el == document ? window : null;
  if (val == undefined) return win ? win[ prop ] : el[ method ];
  if (win) win.scrollTo(!top ? val : win.pageXOffset, top ? val : win.pageYOffset);
  else el[method] = val;
  return el;
}

$.scrollTop = $.scroll_top = el => baseScroll(el, undefined, "pageYOffset", "scrollTop");

$.scrollLeft = $.scroll_left = el => baseScroll(el, undefined, "pageXOffset", "scrollLeft");

$.setScrollTop = $.set_scroll_top = (val, el) => baseScroll(el, val, "pageYOffset", "scrollTop");

$.setScrollLeft = $.set_scroll_left = (val, el) => baseScroll(el, val, "pageXOffset", "scrollLeft");

$.offset = el => {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.pageYOffset - docEl.clientTop,
    left: rect.left + window.pageXOffset - docEl.clientLeft
  };
};

const baseOnOff = method => (event, sel, f, ...opts) => tap(el =>
  !isString(sel) ?
    el[method](event, sel, ...[f, ...opts]) :
  go(el,
    $.findAll(sel),
    each(el => el[method](event, f, ...opts)))
);

$.on = baseOnOff('addEventListener');
$.off = baseOnOff('removeEventListener');

$.delegate = (event, sel, f) => tap(el =>
  el.addEventListener(event, e => go(
    el,
    $.findAll(sel),
    L.filter(el => el.contains(e.target)),
    each(currentTarget => f(defaults({ originalEvent: e, currentTarget, delegateTarget: el }, e)))
  ))
);

const me = 'MouseEvents';
const mouseEvents = {
  click: me,
  mousedown: me,
  mouseup: me,
  mousemove: me,
};

$.trigger = function(event, props, el) {
  if (!el) { el = props; props = {}; }
  if (event == 'submit') return el.submit(), el;
  let e = document.createEvent(mouseEvents[event] || 'Events');
  var bubbles = true;
  for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (e[name] = props[name]);
  e.initEvent(event, bubbles, true);
  el.dispatchEvent(e);
  return el;
};

$.focus = el => el.focus();
$.blur = el => el.blur();

const
  resJSON = res => res.ok ? res.json() : Promise.reject(res),

  fetchBaseOpt = {
    headers: { "Content-Type": "application/json" },
    credentials: 'same-origin'
  },

  fetchBaseOptF = headers => headers ? defaults({
    headers: defaults(headers, fetchBaseOpt.headers)
  }, fetchBaseOpt) : fetchBaseOpt,

  fetchWithBody = method => curry((url, data, headers) => go(
    fetch(url, Object.assign({
      method: method,
      body: JSON.stringify(data)
    }, fetchBaseOptF(headers))),
    resJSON));

$.get = curry((url, data, headers) => go(
  fetch(url + (data === undefined ? '' : '?' + $.param(data)), fetchBaseOptF(headers)),
  resJSON
));

$.post = fetchWithBody('POST');
$.put = fetchWithBody('PUT');
$.delete = fetchWithBody('DELETE');

$.post_form = curry((url, form_el) => go(
  new FormData(form_el),
  form => fetch(url, { method: 'POST', body: form }),
  res => res.ok ? res.json() : Promise.reject(res),
));

$.param = pipe(
  L.entries,
  L.reject(([_, a]) => isUndefined(a)),
  L.map(map(encodeURIComponent)),
  map(([k, v]) => `${k}=${v}`),
  strs => strs.join('&').replace(/%20/g, '+'));

const dataMap = new WeakMap();

$.setData = $.set_data = curry((data, el) => {
  dataMap.set(el, data);
  return el;
});

$.data = el => {
  if (dataMap.has(el)) return dataMap.get(el);
  $.setData(JSON.parse($.attr('fxd-data', el)), el);
  $.setAttr(['fxd-data', 'IN_WEAK_MAP'], el);
  return dataMap.get(el);
};

const toCamel = str => str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

$.css = curry((k, el) =>
  typeof k == 'string' ?
    el.style[k] || el.ownerDocument.defaultView.getComputedStyle(el, null)[toCamel(k)] :
  /* isArray(k) ? */
    object(L.map(k => [k, $.css(k, el)], k)));

var numberTypes = {
  "animationIterationCount": true,
  "columnCount": true,
  "fillOpacity": true,
  "flexGrow": true,
  "flexShrink": true,
  "fontWeight": true,
  "lineHeight": true,
  "opacity": true,
  "order": true,
  "orphans": true,
  "widows": true,
  "zIndex": true,
  "zoom": true
};

const isNumeric = n => !isNaN(parseFloat(n)) && isFinite(n);

const addPx = (k, v) => numberTypes[k] ? v : isNumeric(v) ? v + 'px' : v;

$.setCss = $.set_css = curry((kv, el) => {
  if (isArray(kv)) {
    const k = toCamel(kv[0]);
    el.style[k] = addPx(k, kv[1]);
  } else {
    each(kv => $.setCss(kv, el), L.entries(kv));
  }
  return el;
});

const docWidth = (isHeight, b = document.body) =>
  isHeight ?
    Math.max(b.offsetHeight, b.scrollHeight, docEl.offsetHeight, docEl.offsetHeight, docEl.clientHeight) :
    Math.max(b.offsetWidth, b.scrollWidth, docEl.offsetWidth, docEl.offsetWidth, docEl.clientWidth);

const cssF = (k, el) => parseFloat($.css(k, el)) || 0;

function elWidth(el, prefix = '', isHeight) {
  if (isHeight) var width = 'height', Left = 'Top', Right = 'Bottom';
  else width = 'width', Left = 'Left', Right = 'Right';

  const hide = $.css('display', el) == 'none' && $.show(el);

  let res = cssF(width, el);
  const isBorderBox = $.css('boxSizing', el) == 'border-box';
  const borderBoxVal = (prefix && !isBorderBox) || (!prefix && isBorderBox) ?
    cssF('border'+Left+'Width', el) +
    cssF('border'+Right+'Width', el) +
    cssF('padding'+Left, el) +
    cssF('padding'+Right, el) : 0;
  res += prefix ? borderBoxVal : -borderBoxVal;
  if (prefix == 'outer') res += cssF('margin'+Left, el) + cssF('margin'+Right, el);

  hide && $.hide(el);

  return res;
}

$.width = el => el == window ? el.innerWidth : el == document ? docWidth() : elWidth(el);
$.innerWidth = $.inner_width = el => elWidth(el, 'inner');
$.outerWidth = $.outer_width = el => elWidth(el, 'outer');

$.height = el => el == window ? el.innerHeight : el == document ? docWidth(true) : elWidth(el, '', true);
$.innerHeight = $.inner_height = el => elWidth(el, 'inner', true);
$.outerHeight = $.outer_height = el => elWidth(el, 'outer', true);

const defaultDisplays = {};
function getDefaultDisplays(el) {
  var nodeName = el.nodeName, display = defaultDisplays[nodeName];
  if (display) return display;

  var temp, doc = el.ownerDocument;
  temp = doc.body.appendChild(doc.createElement(nodeName));
  display = $.css('display', temp);
  temp.parentNode.removeChild(temp);

  if (display == 'none') display = 'block';
  return defaultDisplays[nodeName] = display;
}

const prevDisplays = new WeakMap();

$.show = el => {
  if (el.style.display == 'none') el.style.display = '';
  if ($.css('display', el) == 'none') el.style.display = getDefaultDisplays(el);
  return el;
};

$.hide = el => {
  const prev_display = $.css('display', el);
  if (prev_display != 'none') {
    prevDisplays.set(el, prev_display);
    el.style.display = 'none';
  }
  return el;
};

$.toggle = el => $.css('display', el) == 'none' ? $.show(el) : $.hide(el);