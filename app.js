const firebaseConfig = {
    apiKey: "AIzaSyCsFu4-1w2bZAG3OZPt3pcIBDdQVPtcjvg",
    authDomain: "findtutor-e2403.firebaseapp.com",
    projectId: "findtutor-e2403",
    storageBucket: "findtutor-e2403.firebasestorage.app",
    messagingSenderId: "741579317921",
    appId: "1:741579317921:web:4e2ee1c61419fde6c6c6e0"
  };

var _db = null

function _initFirebase() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig)
    _db = firebase.firestore()
    _db.enablePersistence({ synchronizeTabs: true }).catch(function(){})
  } catch(e) {}
}

if (typeof firebase !== 'undefined') {
  _initFirebase()
}

var FT_DB  = 'ft_v3_users'
var FT_CUR = 'ft_v3_cur'
var _usersCache = null

function _loadUsers(cb) {
  if (_db) {
    _db.collection(FT_DB).get().then(function(snap) {
      _usersCache = snap.docs.map(function(d) { return d.data() })
      if (cb) cb(_usersCache)
    }).catch(function() {
      _usersCache = _usersCache || []
      if (cb) cb(_usersCache)
    })
  } else {
    _usersCache = _usersCache || []
    if (cb) cb(_usersCache)
  }
}

function getUsers()  { return _usersCache || [] }
function getTutors() { return getUsers().filter(function(u) { return u.role === 'tutor' }) }
function getCurrent(){ return JSON.parse(localStorage.getItem(FT_CUR) || 'null') }

function saveUser(u) {
  if (!_usersCache) _usersCache = []
  var idx = _usersCache.findIndex(function(x) { return x.id === u.id })
  if (idx !== -1) _usersCache[idx] = u; else _usersCache.push(u)
  var cur = getCurrent()
  if (cur && cur.id === u.id) localStorage.setItem(FT_CUR, JSON.stringify(u))
  if (_db) _db.collection(FT_DB).doc(String(u.id)).set(u).catch(function(){})
}

function _deleteUser(id) {
  if (!_usersCache) return
  _usersCache = _usersCache.filter(function(u) { return u.id !== id })
  if (_db) _db.collection(FT_DB).doc(String(id)).delete().catch(function(){})
}

function logout() {
  localStorage.removeItem(FT_CUR)
  window.location.href = 'index.html'
}

function requireAuth() {
  var u = getCurrent()
  if (!u) { window.location.href = 'login.html'; return null }
  return u
}

function requireAdmin() {
  var u = getCurrent()
  if (!u || u.role !== 'admin') { window.location.href = 'login.html'; return null }
  return u
}

function createAdmin() {
  _loadUsers(function(users) {
    if (users.find(function(u) { return u.role === 'admin' })) {
      alert('Админ уже существует!\nEmail: admin@findtutor.ru\nПароль: admin123')
      return
    }
    var admin = { id: Date.now(), firstName: 'Админ', lastName: '', email: 'admin@findtutor.ru', password: 'admin123', role: 'admin' }
    saveUser(admin)
    alert('Готово!\nEmail: admin@findtutor.ru\nПароль: admin123')
  })
}

function getReviews(tutorId, cb) {
  var key = 'ft_v3_rev_' + tutorId
  if (_db) {
    _db.collection('ft_v3_reviews').doc(String(tutorId)).get().then(function(doc) {
      var revs = doc.exists ? (doc.data().list || []) : []
      var local = JSON.parse(localStorage.getItem(key) || '[]')
      if (local.length > 0 && revs.length === 0) {
        revs = local
        _db.collection('ft_v3_reviews').doc(String(tutorId)).set({ list: revs })
        localStorage.removeItem(key)
      }
      cb(revs)
    }).catch(function() {
      cb(JSON.parse(localStorage.getItem(key) || '[]'))
    })
  } else {
    cb(JSON.parse(localStorage.getItem(key) || '[]'))
  }
}

function saveReviews(tutorId, revs, cb) {
  if (_db) {
    _db.collection('ft_v3_reviews').doc(String(tutorId)).set({ list: revs }).then(function() {
      if (cb) cb()
    }).catch(function() {
      localStorage.setItem('ft_v3_rev_' + tutorId, JSON.stringify(revs))
      if (cb) cb()
    })
  } else {
    localStorage.setItem('ft_v3_rev_' + tutorId, JSON.stringify(revs))
    if (cb) cb()
  }
}

var _avColors = [
  {bg:'#fff3bf',color:'#7a4900'}, {bg:'#d3f9d8',color:'#1e6e30'},
  {bg:'#e8f0fe',color:'#1a3a8f'}, {bg:'#fff0f6',color:'#8c1a4b'},
  {bg:'#f3d9fa',color:'#6a1a7a'}, {bg:'#e6fcf5',color:'#065c44'},
  {bg:'#fff4e6',color:'#8a3a00'}, {bg:'#f0f4ff',color:'#2845c8'}
]
function avatarColor(name) { return _avColors[(name||'А').charCodeAt(0) % _avColors.length] }
function initials(f,l) { return (f?f[0].toUpperCase():'')+(l?l[0].toUpperCase():'') }

function starsHTML(r) {
  if (!r) return ''
  var s = '', n = Math.round(r)
  for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '☆'
  return s
}

function ratingText(r) {
  if (!r || r === 0) return '<span style="color:var(--text-muted);font-size:12px">нет оценок</span>'
  return '<span style="color:#f59e0b">' + starsHTML(r) + '</span> ' + r.toFixed(1)
}

function formatLabel(f) {
  if (f === 'online')  return 'Онлайн'
  if (f === 'offline') return 'Очно'
  if (f === 'both')    return 'Онлайн · Очно'
  return f || 'Не указан'
}

function matchFormat(tutorFmt, filterFmt) {
  if (!filterFmt) return true
  if (tutorFmt === filterFmt) return true
  if (tutorFmt === 'both') return true
  return false
}

function escHtml(s) {
  return (s || '').toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function showError(id, msg) {
  var el = document.getElementById(id)
  if (!el) return
  el.textContent   = msg
  el.style.display = 'block'
}

function renderTutorCard(t) {
  var c = avatarColor(t.firstName), ini = initials(t.firstName, t.lastName)
  var badge = t.verified
    ? '<span class="badge-verified">✓</span>'
    : '<span class="badge-pending">⏳</span>'
  return '<a href="tutor.html?id=' + t.id + '" class="tutor-card">' +
    '<div class="tutor-card__top">' +
      '<div class="tutor-card__avatar" style="background:' + c.bg + ';color:' + c.color + '">' + ini + '</div>' +
      '<div class="tutor-card__info">' +
        '<div class="tutor-card__name">' + escHtml(t.firstName) + ' ' + escHtml(t.lastName) + ' ' + badge + '</div>' +
        '<div class="tutor-card__subject">' + escHtml(t.subject || '') + '</div>' +
        '<div class="tutor-card__stars">' + ratingText(t.rating) + '</div>' +
      '</div>' +
    '</div>' +
    '<p class="tutor-card__about">' + escHtml(t.about || 'Репетитор ещё не заполнил анкету.') + '</p>' +
    '<div class="tutor-card__footer">' +
      '<span class="tutor-card__price">' + (t.price ? escHtml(t.price) + ' ₽/час' : 'Цена не указана') + '</span>' +
      '<span class="tutor-card__format">' + formatLabel(t.format) + '</span>' +
    '</div>' +
  '</a>'
}

function renderTutorRow(t) {
  var c = avatarColor(t.firstName), ini = initials(t.firstName, t.lastName)
  var badge = t.verified
    ? '<span class="badge-verified">✓</span>'
    : '<span class="badge-pending">⏳</span>'
  return '<div class="tutor-row" onclick="window.location.href=\'tutor.html?id=' + t.id + '\'">' +
    '<div class="tutor-row__avatar" style="background:' + c.bg + ';color:' + c.color + '">' + ini + '</div>' +
    '<div class="tutor-row__info">' +
      '<div class="tutor-row__name">' + escHtml(t.firstName) + ' ' + escHtml(t.lastName) + ' ' + badge + '</div>' +
      '<div class="tutor-row__subject">' + escHtml(t.subject || '') + (t.city ? ' · ' + escHtml(t.city) : '') + '</div>' +
      '<div class="tutor-row__about">' + escHtml(t.about || '') + '</div>' +
    '</div>' +
    '<div class="tutor-row__right">' +
      '<div class="tutor-row__price">' + (t.price ? escHtml(t.price) + ' ₽/час' : '—') + '</div>' +
      '<div class="tutor-row__format">' + formatLabel(t.format) + '</div>' +
      '<div>' + ratingText(t.rating) + '</div>' +
      '<a href="tutor.html?id=' + t.id + '" class="btn btn--primary" style="margin-top:10px;display:inline-block" onclick="event.stopPropagation()" data-tip="Открыть анкету">Смотреть анкету</a>' +
    '</div>' +
  '</div>'
}

function updateHeader() {
  var u    = getCurrent()
  var btns = document.getElementById('headerBtns')
  if (!btns) return
  if (u) {
    var dest = u.role === 'admin' ? 'admin.html' : 'cabinet.html'
    btns.innerHTML =
      '<a href="' + dest + '" class="btn btn--outline">' + escHtml(u.firstName) + '</a>' +
      '<button class="btn btn--primary" onclick="logout()" data-tip="Выйти из аккаунта">Выйти</button>'
  } else {
    btns.innerHTML =
      '<a href="login.html"    class="btn btn--outline" data-tip="Войти в аккаунт">Войти</a>' +
      '<a href="register.html" class="btn btn--primary" data-tip="Создать аккаунт бесплатно">Регистрация</a>'
  }
}

function getParam(name) { return new URLSearchParams(window.location.search).get(name) }

document.addEventListener('click', function(e) {
  var btn = e.target.closest('.btn, .btn--primary, .btn--outline, .btn--white')
  if (!btn) return
  var r    = document.createElement('span')
  var rect = btn.getBoundingClientRect()
  var sz   = Math.max(rect.width, rect.height)
  r.className     = 'ripple'
  r.style.cssText = 'width:'+sz+'px;height:'+sz+'px;left:'+(e.clientX-rect.left-sz/2)+'px;top:'+(e.clientY-rect.top-sz/2)+'px'
  btn.appendChild(r)
  setTimeout(function() { r.remove() }, 600)
})

window.addEventListener('load', function() {
  setTimeout(function() {
    if (!_db && typeof firebase !== 'undefined') _initFirebase()
    _loadUsers(function() {
      document.dispatchEvent(new CustomEvent('ft:ready'))
    })
  }, 300)
})
