import { useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard({ initialState, isGuest }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__ledgerInitialized) return; // guard against React 18 dev double-invoke
    window.__ledgerInitialized = true;
    initLedgerApp(initialState, { isGuest: !!isGuest });
  }, [initialState, isGuest]);

  return (
    <>      <Head>
        <title>Budgy — Spending Tracker</title>
      </Head>

      <div className="sheet">
        {isGuest && <div className="guest-banner">👋 Guest Demo — fake data, not real spending</div>}
        <header>
          <div className="sticky-header">
            <div className="brand-row">
              <button className="hamburger-btn" id="navMenuBtn" aria-label="Open menu">☰</button>
              <div className="brand">Budgy</div>
              <button className="analytics-icon-btn" id="analyticsBtn" aria-label="View analytics">📊</button>
            </div>
            <div className="month-nav">
              <button id="prevMonth" aria-label="Previous month">‹</button>
              <h1 id="monthLabel">—</h1>
              <button id="nextMonth" aria-label="Next month">›</button>
            </div>
          </div>
          <div className="totals">
            <div className="total-block">
              <span className="total-label">SPENT</span>
              <span className="total-amt" id="totalSpent">$0.00</span>
            </div>
            <div className="total-block">
              <span className="total-label">BUDGETED</span>
              <span className="total-amt" id="totalBudget">$0.00</span>
            </div>
          </div>
          <button className="reauth-banner" id="reauthBanner">
            <span id="reauthText"></span><span className="arrow">→</span>
          </button>
          <button className="pending-banner" id="pendingBanner">
            <span id="pendingText"></span><span className="arrow">→</span>
          </button>
        </header>

        <div className="perf"></div>

        <main id="categoryList"></main>

        <button className="add-cat-btn" id="addCategoryBtn">+ ADD CATEGORY</button>
        <div className="fab-wrap">
          <button className="fab" id="simulateBtn">+ ADD TRANSACTION</button>
          <div className="hint">Manual entry — for cash or any other transactions</div>
        </div>
      </div>

      <div className="nav-backdrop" id="navBackdrop"></div>
      <div className="nav-overlay" id="navOverlay" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="nav-header">
          <div className="nav-title">Menu</div>
          <button className="nav-close" id="navClose" aria-label="Close menu">✕</button>
        </div>
        <button className={'nav-item nav-item-toggle' + (isGuest ? ' nav-item-disabled' : '')} id="connectBankBtn" disabled={isGuest}>
          <span>Connect Bank Account</span>
          {isGuest && <span className="owner-only-badge">Owner Only</span>}
        </button>
        <button className="nav-item" id="manageCategoriesBtn">Edit Budget Categories</button>
        <button className="nav-item" id="backfillBtn">Enter Past Spending</button>
        <button className="nav-item" id="exportBtn">Export Transactions</button>
        <button className={'nav-item nav-item-toggle' + (isGuest ? ' nav-item-disabled' : '')} id="notificationsToggleRow" disabled={isGuest}>
          <span>Notifications{isGuest && <span className="owner-only-badge">Owner Only</span>}</span>
          <span className="toggle-switch" id="notificationsToggleSwitch"><span className="toggle-knob"></span></span>
        </button>
        {isGuest && <button className="nav-item" id="resetGuestBtn">Reset Demo Data</button>}
        <div className="nav-divider"></div>
        <button className="nav-item nav-item-danger" id="signOutBtn">Sign Out</button>
      </div>

      <div className="modal-overlay" id="modalOverlay">
        <div className="modal" id="modalContent" role="dialog" aria-modal="true"></div>
      </div>

      <div className="cz-overlay" id="czOverlay" role="dialog" aria-modal="true" aria-label="Categorize transactions">
        <div className="cz-top-row">
          <div className="cz-progressbar"><div className="cz-progressbar-fill" id="czProgressBarFill"></div></div>
          <span className="cz-progress-count" id="czProgressCount"></span>
          <button className="cz-close" id="czClose" aria-label="Close">✕</button>
        </div>
        <div className="cz-body" id="czBody"></div>
      </div>

      <div className="az-overlay" id="azOverlay" role="dialog" aria-modal="true" aria-label="Analytics">
        <div className="az-top">
          <div className="az-title">Analytics</div>
          <button className="az-close" id="azClose" aria-label="Close">✕</button>
        </div>
        <div className="az-tabs" id="azPresetTabs">
          <button className="az-tab active" data-preset="thisMonth">This Month</button>
          <button className="az-tab" data-preset="ytd">YTD</button>
          <button className="az-tab" data-preset="lastYear">Last Year</button>
          <button className="az-tab" data-preset="custom">Custom</button>
        </div>
        <div className="az-custom-range" id="azCustomRange" hidden>
          <input type="date" id="azCustomFrom" />
          <span>to</span>
          <input type="date" id="azCustomTo" />
          <button className="btn-primary" id="azCustomApply">Apply</button>
        </div>
        <div className="az-body" id="azBody"></div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// Everything below is the prototype's logic, ported to talk to the real
// API routes (pages/api/*) instead of window.storage. Runs client-side
// only, once, from the useEffect above.
// ---------------------------------------------------------------------
function initLedgerApp(initialState, options) {
  var isGuest = !!(options && options.isGuest);
  var API_BASE = isGuest ? '/api/guest' : '/api';

  // window.innerHeight/vh units don't reliably shrink when a mobile keyboard
  // opens, which can leave modal content (and its buttons) hidden with no
  // way to scroll to them. visualViewport tracks the actually-visible area.
  function setViewportHeightVar(){
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vvh', vh + 'px');
  }
  setViewportHeightVar();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setViewportHeightVar);
  } else {
    window.addEventListener('resize', setViewportHeightVar);
  }

  var now = new Date();
  var todayMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var currentMonth = todayMonth;
  var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var CATEGORY_PALETTE = [
    {bg:'#f65767', fg:'#FFFFFF'},
    {bg:'#f5b766', fg:'#2D3047'},
    {bg:'#f0f56c', fg:'#2D3047'},
    {bg:'#8fe776', fg:'#2D3047'},
    {bg:'#00d6d6', fg:'#2D3047'},
    {bg:'#38ade8', fg:'#FFFFFF'},
    {bg:'#4961eb', fg:'#FFFFFF'},
    {bg:'#c47df7', fg:'#2D3047'},
    {bg:'#eb57e3', fg:'#FFFFFF'}
  ];
  function colorFor(cat){
    var idx = (cat.colorIdx || 0) % CATEGORY_PALETTE.length;
    return CATEGORY_PALETTE[idx];
  }

  var state = Object.assign(
    { categories: [], budgets: {}, transactions: [], plaidItems: [] },
    initialState || {}
  );

  function load(){
    return fetch(API_BASE + '/state')
      .then(function(r){
        if (!r.ok) throw new Error('Failed to load state (' + r.status + ')');
        return r.json();
      })
      .then(function(data){
        state = Object.assign(
          { categories: [], budgets: {}, transactions: [], plaidItems: [] },
          data || {}
        );
      });
  }

  // Wraps fetch so a failed request surfaces a real, visible error instead
  // of the button silently doing nothing — the previous behavior made
  // production issues (bad DATABASE_URL, missing env vars, etc.) look like
  // the app just wasn't responding at all.
  function apiFetch(url, options){
    return fetch(url, options).then(function(r){
      if (!r.ok){
        return r.json().catch(function(){ return {}; }).then(function(body){
          throw new Error((body && body.error) || (url + ' failed (' + r.status + ')'));
        });
      }
      return r.json().catch(function(){ return {}; });
    });
  }
  function showApiError(err){
    console.error(err);
    alert('Something went wrong: ' + err.message + '\n\nCheck the browser console and your server logs for details.');
  }

  function fmt(n){
    var sign = n < 0 ? '-' : '';
    var parts = Math.abs(n).toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + '$' + parts[0] + '.' + parts[1];
  }

  function budgetFor(catId, month){
    var key = catId + '|' + month;
    if (state.budgets[key] !== undefined) return state.budgets[key];
    var months = Object.keys(state.budgets)
      .filter(function(k){ return k.indexOf(catId+'|')===0; })
      .map(function(k){ return k.split('|')[1]; })
      .filter(function(m){ return m < month; })
      .sort();
    if (months.length) return state.budgets[catId + '|' + months[months.length-1]];
    return 0;
  }

  function spentFor(catId, month){
    return state.transactions
      .filter(function(t){ return t.categoryId===catId && t.date.indexOf(month)===0; })
      .reduce(function(sum,t){ return sum + t.amount; }, 0);
  }

  function statusFor(spent, budget){
    if (!budget) return 'none';
    var pct = spent / budget * 100;
    if (pct >= 100) return 'over';
    if (pct >= 80) return 'warn';
    return 'good';
  }

  function getPending(){
    return state.transactions
      .filter(function(t){ return !t.categoryId; })
      .sort(function(a,b){ return a.date.localeCompare(b.date); });
  }

  function catName(id){
    if (!id) return 'Uncategorized';
    var c = state.categories.find(function(x){ return x.id===id; });
    return c ? c.name : 'Uncategorized';
  }
  function catDotColor(id){
    var c = state.categories.find(function(x){ return x.id===id; });
    return c ? colorFor(c).bg : '#C9C9D6';
  }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function render(){
    var parts = currentMonth.split('-');
    var y = parts[0], m = parts[1];
    document.getElementById('monthLabel').textContent = monthNames[parseInt(m,10)-1] + ' ' + y;

    var listEl = document.getElementById('categoryList');
    listEl.innerHTML = '';
    var totalSpent = 0, totalBudget = 0;

    state.categories.filter(function(c){ return !c.archived; }).forEach(function(cat, idx){
      var spent = spentFor(cat.id, currentMonth);
      var budget = budgetFor(cat.id, currentMonth);
      if (!cat.excludeFromSpending){
        totalSpent += spent; totalBudget += budget;
      }
      var status = statusFor(spent, budget);
      var pct = budget ? Math.min(100, spent/budget*100) : 0;
      var color = colorFor(cat);

      var card = document.createElement('div');
      card.className = 'cat-card' + (cat.excludeFromSpending ? ' excluded' : '');
      card.style.borderLeftColor = color.bg;

      var stampText = budget ? (status==='over' ? 'OVER' : Math.round(spent/budget*100) + '%') : '—';
      var stampClass = status==='over' ? 'over' : (status==='warn' ? 'warn' : '');

      var txns = state.transactions
        .filter(function(t){ return t.categoryId===cat.id && t.date.indexOf(currentMonth)===0; })
        .sort(function(a,b){ return b.date.localeCompare(a.date); });

      var txnHtml = txns.length
        ? txns.map(function(t){
            var descPart = t.description ? '<div class="txn-desc">'+escapeHtml(t.description)+'</div>' : '';
            return '<div class="txn-row" data-id="'+t.id+'"><span class="txn-info"><b>'+escapeHtml(t.merchant)+'</b> · '+t.date.slice(5)+descPart+'</span><span>'+fmt(t.amount)+'</span></div>';
          }).join('')
        : '<div class="txn-empty">No transactions this month.</div>';

      var exclTag = cat.excludeFromSpending ? '<span class="excl-tag">NOT COUNTED</span>' : '';

      var stampHtml = cat.excludeFromSpending ? '' : '<div class="stamp '+stampClass+'">'+stampText+'</div>';
      var amtsHtml = cat.excludeFromSpending
        ? '<div class="cat-amts-row"><div class="cat-amts"><span class="spent">'+fmt(spent)+'</span></div></div>'
        : '<div class="cat-amts-row"><div class="cat-amts"><span class="spent">'+fmt(spent)+'</span><span class="slash"> / </span><span class="budget" data-cat="'+cat.id+'" tabindex="0" role="button" aria-label="Edit budget for '+escapeHtml(cat.name)+'">'+fmt(budget)+'</span></div></div>';
      var barHtml = cat.excludeFromSpending ? '' : '<div class="bar"><div class="bar-fill '+(status==='over'?'over':status==='warn'?'warn':'')+'" style="width:'+pct+'%"></div></div>';

      card.innerHTML =
        '<div class="cat-top">'+
          '<div class="cat-name">'+
            '<span class="cat-dot" style="background:'+color.bg+'"></span>'+escapeHtml(cat.name)+exclTag+
          '</div>'+
          stampHtml+
        '</div>'+
        amtsHtml+
        barHtml+
        '<div class="cat-meta">'+
          '<span class="txn-count">'+txns.length+' transaction'+(txns.length===1?'':'s')+'</span>'+
          '<button class="expand-btn" aria-expanded="false">▾</button>'+
        '</div>'+
        '<div class="txn-list" hidden>'+txnHtml+'<button class="del-cat" data-cat="'+cat.id+'">Remove category</button></div>';

      listEl.appendChild(card);
    });

    document.getElementById('totalSpent').textContent = fmt(totalSpent);
    document.getElementById('totalBudget').textContent = fmt(totalBudget);

    var needsReauthItems = (state.plaidItems || []).filter(function(i){ return i.needsReauth; });
    var reauthBanner = document.getElementById('reauthBanner');
    if (needsReauthItems.length){
      reauthBanner.classList.add('show');
      document.getElementById('reauthText').textContent =
        needsReauthItems.length + (needsReauthItems.length===1 ? ' CONNECTION NEEDS ATTENTION' : ' CONNECTIONS NEED ATTENTION');
    } else {
      reauthBanner.classList.remove('show');
    }

    var pending = getPending();
    var banner = document.getElementById('pendingBanner');
    if (pending.length){
      banner.classList.add('show');
      document.getElementById('pendingText').textContent =
        pending.length + (pending.length===1 ? ' TRANSACTION TO CATEGORIZE' : ' TRANSACTIONS TO CATEGORIZE');
    } else {
      banner.classList.remove('show');
    }

    attachCardEvents();
  }

  function attachCardEvents(){
    document.querySelectorAll('.expand-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var list = btn.closest('.cat-card').querySelector('.txn-list');
        var isHidden = list.hasAttribute('hidden');
        if (isHidden){ list.removeAttribute('hidden'); btn.textContent='▴'; btn.setAttribute('aria-expanded','true'); }
        else { list.setAttribute('hidden',''); btn.textContent='▾'; btn.setAttribute('aria-expanded','false'); }
      });
    });
    document.querySelectorAll('.budget').forEach(function(el){
      function activate(){
        var catId = el.getAttribute('data-cat');
        var current = budgetFor(catId, currentMonth);
        var input = document.createElement('input');
        input.type = 'number'; input.min = '0'; input.step = '0.01';
        input.value = current.toFixed(2);
        el.replaceWith(input);
        input.focus(); input.select();
        function commit(){
          var val = parseFloat(input.value);
          if (!isNaN(val) && val >= 0){
            fetch(API_BASE + '/budgets', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ categoryId: catId, month: currentMonth, amount: val })
            }).then(function(){ return load(); }).then(render);
          } else { render(); }
        }
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', function(e){
          if (e.key==='Enter') input.blur();
          if (e.key==='Escape'){ input.value = current; input.blur(); }
        });
      }
      el.addEventListener('click', activate);
      el.addEventListener('keydown', function(e){ if(e.key==='Enter') activate(); });
    });
    document.querySelectorAll('.del-cat').forEach(function(btn){
      btn.addEventListener('click', function(){
        var catId = btn.getAttribute('data-cat');
        var cat = state.categories.find(function(c){ return c.id===catId; });
        openConfirmDelete(cat);
      });
    });
    document.querySelectorAll('.txn-row[data-id]').forEach(function(row){
      row.addEventListener('click', function(){
        var tid = row.getAttribute('data-id');
        var t = state.transactions.find(function(x){ return x.id===tid; });
        if (t) openEditTransaction(t);
      });
    });
  }

  // generic modal
  var overlay = document.getElementById('modalOverlay');
  var modal = document.getElementById('modalContent');
  function closeModal(){ overlay.classList.remove('open'); modal.innerHTML=''; }
  overlay.addEventListener('click', function(e){ if (e.target===overlay) closeModal(); });
  document.addEventListener('keydown', function(e){ if (e.key==='Escape' && overlay.classList.contains('open')) closeModal(); });
  overlay.addEventListener('focusin', function(e){
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'){
      setTimeout(function(){
        e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 300); // wait out the on-screen keyboard's open animation
    }
  });

  function openAddCategory(){
    modal.innerHTML =
      '<h2>New category</h2>'+
      '<div class="field"><label for="catName">Name</label><input id="catName" type="text" placeholder="e.g. Health"></div>'+
      '<div class="field"><label for="catBudget">Monthly budget</label><input id="catBudget" type="number" min="0" step="0.01" placeholder="0.00"></div>'+
      '<div class="field-checkbox"><input id="catExclude" type="checkbox"><label for="catExclude">Don\'t count transactions in this category toward my spent totals<br><span class="field-hint">For things like reimbursements or transfers that aren\'t real spending</span></label></div>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelAdd">Cancel</button>'+
        '<button class="btn-primary" id="confirmAdd">Add category</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('catName').focus();
    document.getElementById('cancelAdd').addEventListener('click', closeModal);
    document.getElementById('confirmAdd').addEventListener('click', function(){
      var name = document.getElementById('catName').value.trim();
      var budget = parseFloat(document.getElementById('catBudget').value) || 0;
      var excludeFromSpending = document.getElementById('catExclude').checked;
      if (!name) return;
      apiFetch(API_BASE + '/categories', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: name, budget: budget, month: currentMonth, excludeFromSpending: excludeFromSpending })
      }).then(function(){ return load(); }).then(function(){ closeModal(); render(); }).catch(showApiError);
    });
  }

  function openConfirmDelete(cat){
    modal.innerHTML =
      '<h2>Remove "'+escapeHtml(cat.name)+'"?</h2>'+
      '<p style="font-size:13px;color:var(--ink-soft);margin:0 0 4px;">Past transactions keep this category — nothing gets sent back to "to categorize." You just won\'t be able to file new transactions under it going forward.</p>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelDel">Cancel</button>'+
        '<button class="btn-primary" id="confirmDel" style="background:var(--red);">Remove</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('cancelDel').addEventListener('click', closeModal);
    document.getElementById('confirmDel').addEventListener('click', function(){
      apiFetch(API_BASE + '/categories/' + cat.id, { method:'DELETE' })
        .then(function(){ return load(); })
        .then(function(){ closeModal(); render(); })
        .catch(showApiError);
    });
  }

  function openEditTransaction(t){
    var options = state.categories
      .filter(function(c){ return !c.archived || c.id===t.categoryId; })
      .map(function(c){
        var label = c.archived ? c.name + ' (archived)' : c.name;
        return '<option value="'+c.id+'"'+(c.id===t.categoryId?' selected':'')+'>'+escapeHtml(label)+'</option>';
      }).join('');
    modal.innerHTML =
      '<h2>Edit transaction</h2>'+
      '<div class="field"><label>Details</label><div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:var(--ink-soft);padding:2px 0 4px;">'+escapeHtml(t.merchant)+' · '+fmt(t.amount)+' · '+t.date+'</div></div>'+
      '<div class="field"><label for="editCat">Category</label><select id="editCat">'+options+'</select></div>'+
      '<div class="field"><label for="editDesc">Description (optional)</label><input id="editDesc" type="text" placeholder="e.g. Split with roommate" value="'+escapeHtml(t.description||'')+'"></div>'+
      '<button class="txn-delete-link" id="deleteTxnBtn">🗑 Delete transaction</button>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelEdit">Cancel</button>'+
        '<button class="btn-primary" id="confirmEdit">Save</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('cancelEdit').addEventListener('click', closeModal);
    document.getElementById('confirmEdit').addEventListener('click', function(){
      var categoryId = document.getElementById('editCat').value;
      var description = document.getElementById('editDesc').value.trim();
      fetch(API_BASE + '/transactions/' + t.id, {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ categoryId: categoryId, description: description })
      }).then(function(){ return load(); }).then(function(){
        closeModal();
        render();
        if (document.getElementById('azOverlay').classList.contains('open')) renderAnalytics();
      });
    });
    document.getElementById('deleteTxnBtn').addEventListener('click', function(){
      openConfirmDeleteTransaction(t);
    });
  }

  function openConfirmDeleteTransaction(t){
    modal.innerHTML =
      '<h2>Delete this transaction?</h2>'+
      '<p style="font-size:13px;color:var(--ink-soft);margin:0 0 4px;">'+escapeHtml(t.merchant)+' · '+fmt(t.amount)+' · '+t.date+'</p>'+
      '<p style="font-size:13px;color:var(--ink-soft);margin:8px 0 4px;">This can\'t be undone.</p>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelDeleteTxn">Cancel</button>'+
        '<button class="btn-primary" id="confirmDeleteTxn" style="background:var(--red);">Delete</button>'+
      '</div>';
    document.getElementById('cancelDeleteTxn').addEventListener('click', function(){ openEditTransaction(t); });
    document.getElementById('confirmDeleteTxn').addEventListener('click', function(){
      var btn = document.getElementById('confirmDeleteTxn');
      btn.disabled = true;
      btn.textContent = 'Deleting…';
      apiFetch(API_BASE + '/transactions/' + t.id, { method:'DELETE' })
        .then(function(){ return load(); })
        .then(function(){
          closeModal();
          render();
          if (document.getElementById('azOverlay').classList.contains('open')) renderAnalytics();
        })
        .catch(function(err){
          btn.disabled = false;
          btn.textContent = 'Delete';
          showApiError(err);
        });
    });
  }

  function openSimulate(){
    var today = new Date().toISOString().slice(0,10);
    modal.innerHTML =
      '<h2>Add transaction</h2>'+
      '<p style="font-size:12px;color:var(--ink-soft);margin:-8px 0 16px;">Arrives uncategorized, same as anything Plaid syncs — you\'ll file it next.</p>'+
      '<div class="field"><label for="txnMerchant">Merchant / location</label><input id="txnMerchant" type="text" placeholder="e.g. Amazon"></div>'+
      '<div class="field"><label for="txnAmount">Amount</label><input id="txnAmount" type="number" min="0" step="0.01" placeholder="0.00"></div>'+
      '<div class="field"><label for="txnDate">Date</label><input id="txnDate" type="date" value="'+today+'"></div>'+
      '<div class="field"><label for="txnDesc">Description (optional)</label><input id="txnDesc" type="text" placeholder="e.g. Split with roommate"></div>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelTxn">Cancel</button>'+
        '<button class="btn-primary" id="confirmTxn">Add transaction</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('txnMerchant').focus();
    document.getElementById('cancelTxn').addEventListener('click', closeModal);
    document.getElementById('confirmTxn').addEventListener('click', function(){
      var merchant = document.getElementById('txnMerchant').value.trim() || 'Unknown merchant';
      var amount = parseFloat(document.getElementById('txnAmount').value);
      var date = document.getElementById('txnDate').value || today;
      var description = document.getElementById('txnDesc').value.trim();
      if (isNaN(amount) || amount <= 0) return;
      fetch(API_BASE + '/transactions', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ merchant: merchant, amount: amount, date: date, description: description })
      }).then(function(){ return load(); }).then(function(){
        closeModal();
        openCategorize();
      });
    });
  }

  // hamburger nav drawer
  function openNavMenu(){
    document.getElementById('navOverlay').classList.add('open');
    document.getElementById('navBackdrop').classList.add('open');
    if (!isGuest) refreshNotificationsToggle();
  }
  function closeNavMenu(){
    document.getElementById('navOverlay').classList.remove('open');
    document.getElementById('navBackdrop').classList.remove('open');
  }
  document.getElementById('navMenuBtn').addEventListener('click', openNavMenu);

  // Tapping the sticky header (which stays pinned at the top while
  // scrolling) jumps back to the top of the page — like tapping a site's
  // logo. Ignores clicks on the buttons already inside it (menu,
  // analytics, prev/next month) so their own behavior isn't affected.
  document.querySelector('.sticky-header').addEventListener('click', function(e){
    if (e.target.closest('button')) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('navClose').addEventListener('click', closeNavMenu);
  document.getElementById('navBackdrop').addEventListener('click', closeNavMenu);

  function renderManageCategoriesModal(){
    var rows = state.categories.filter(function(c){ return !c.archived; }).map(function(cat){
      var color = colorFor(cat);
      var tag = cat.excludeFromSpending ? '<span class="excl-tag">NOT COUNTED</span>' : '';
      return '<div class="manage-cat-row" data-cat="'+cat.id+'">'+
        '<span class="drag-handle" aria-label="Drag to reorder">⠿</span>'+
        '<span class="cat-dot" style="background:'+color.bg+'"></span>'+
        '<span class="manage-cat-name" data-cat="'+cat.id+'" tabindex="0" role="button" aria-label="Rename '+escapeHtml(cat.name)+'">'+escapeHtml(cat.name)+'</span>'+
        tag+
        '<button class="cat-rename-btn" data-cat="'+cat.id+'" aria-label="Rename '+escapeHtml(cat.name)+'">✎</button>'+
      '</div>';
    }).join('');

    var archived = state.categories.filter(function(c){ return c.archived; });
    var archivedHtml = '';
    if (archived.length){
      archivedHtml =
        '<div class="manage-cat-archived-title">Archived (' + archived.length + ')</div>'+
        '<div class="manage-cat-list">'+archived.map(function(cat){
          var color = colorFor(cat);
          return '<div class="manage-cat-row archived">'+
            '<span class="cat-dot" style="background:'+color.bg+'"></span>'+
            '<span class="manage-cat-name">'+escapeHtml(cat.name)+'</span>'+
            '<button class="manage-cat-unarchive" data-cat="'+cat.id+'">Unarchive</button>'+
          '</div>';
        }).join('')+'</div>';
    }

    modal.innerHTML =
      '<h2>Edit budget categories</h2>'+
      '<p style="font-size:12px;color:var(--ink-soft);margin:-8px 0 16px;">Drag to reorder how categories appear on your dashboard. Tap the name or ✎ to rename.</p>'+
      '<div class="manage-cat-list" id="manageCatList">'+(rows || '<div class="txn-empty">No categories yet.</div>')+'</div>'+
      archivedHtml+
      '<div class="modal-actions"><button class="btn-secondary" id="closeManageCat">Close</button></div>';
    document.getElementById('closeManageCat').addEventListener('click', closeModal);
    modal.querySelectorAll('.manage-cat-unarchive').forEach(function(btn){
      btn.addEventListener('click', function(){
        var catId = btn.getAttribute('data-cat');
        btn.disabled = true;
        btn.textContent = 'Unarchiving…';
        apiFetch(API_BASE + '/categories/' + catId, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ archived: false })
        }).then(function(){ return load(); }).then(function(){
          render();
          renderManageCategoriesModal();
        }).catch(showApiError);
      });
    });

    function startRename(catId){
      var row = modal.querySelector('.manage-cat-row[data-cat="'+catId+'"]');
      var nameEl = row.querySelector('.manage-cat-name');
      var cat = state.categories.find(function(c){ return c.id===catId; });
      var currentName = cat ? cat.name : '';

      var input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.className = 'manage-cat-rename-input';
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      function commit(){
        var newName = input.value.trim();
        if (!newName || newName === currentName) { renderManageCategoriesModal(); return; }
        apiFetch(API_BASE + '/categories/' + catId, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name: newName })
        }).then(function(){ return load(); }).then(function(){
          render();
          renderManageCategoriesModal();
        }).catch(function(err){
          showApiError(err);
          renderManageCategoriesModal();
        });
      }
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', function(e){
        if (e.key==='Enter') input.blur();
        if (e.key==='Escape'){ input.value = currentName; input.blur(); }
      });
    }
    modal.querySelectorAll('.cat-rename-btn').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        startRename(btn.getAttribute('data-cat'));
      });
    });
    modal.querySelectorAll('.manage-cat-name[data-cat]').forEach(function(nameEl){
      nameEl.addEventListener('click', function(){ startRename(nameEl.getAttribute('data-cat')); });
      nameEl.addEventListener('keydown', function(e){ if (e.key==='Enter') startRename(nameEl.getAttribute('data-cat')); });
    });

    setupCategoryDrag();
  }

  function setupCategoryDrag(){
    var list = document.getElementById('manageCatList');
    if (!list) return;
    var draggingEl = null;

    function rowAfterPointer(y){
      var rows = Array.prototype.slice.call(list.querySelectorAll('.manage-cat-row:not(.dragging)'));
      var closest = null, closestOffset = -Infinity;
      rows.forEach(function(row){
        var box = row.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closestOffset){ closestOffset = offset; closest = row; }
      });
      return closest;
    }
    function onPointerMove(e){
      if (!draggingEl) return;
      var after = rowAfterPointer(e.clientY);
      if (after == null) list.appendChild(draggingEl);
      else if (after !== draggingEl) list.insertBefore(draggingEl, after);
    }
    function onPointerUp(){
      if (!draggingEl) return;
      draggingEl.classList.remove('dragging');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      var newOrder = Array.prototype.slice.call(list.querySelectorAll('.manage-cat-row')).map(function(row){
        return row.getAttribute('data-cat');
      });
      draggingEl = null;
      apiFetch(API_BASE + '/categories/reorder', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ order: newOrder })
      }).then(function(){ return load(); }).then(function(){ render(); }).catch(showApiError);
    }
    list.querySelectorAll('.drag-handle').forEach(function(handle){
      handle.addEventListener('pointerdown', function(e){
        e.preventDefault();
        draggingEl = handle.closest('.manage-cat-row');
        draggingEl.classList.add('dragging');
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
      });
    });
  }
  document.getElementById('manageCategoriesBtn').addEventListener('click', function(){
    closeNavMenu();
    renderManageCategoriesModal();
    overlay.classList.add('open');
  });

  if (isGuest) {
    document.getElementById('resetGuestBtn').addEventListener('click', function(){
      if (!confirm('Reset the demo back to its original fake data? Anything you\'ve added, edited, or deleted will be lost.')) return;
      closeNavMenu();
      apiFetch(API_BASE + '/reset', { method:'POST' })
        .then(function(){ return load(); })
        .then(function(){ render(); alert('Demo data has been reset.'); })
        .catch(showApiError);
    });
  }

  function csvEscape(val){
    var s = val==null ? '' : String(val);
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function fmtDateInput(d){ return d.toISOString().slice(0,10); }

  function downloadTransactionsCsv(from, to){
    var rows = state.transactions
      .filter(function(t){
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return true;
      })
      .sort(function(a,b){ return a.date.localeCompare(b.date); });

    var header = ['Date','Month','Merchant','Category','Amount','Description'];
    var lines = [header.map(csvEscape).join(',')];
    rows.forEach(function(t){
      var d = new Date(t.date + 'T00:00:00');
      var monthLabel = monthNames[d.getMonth()] + ' ' + d.getFullYear();
      var cat = state.categories.find(function(c){ return c.id===t.categoryId; });
      lines.push([
        t.date,
        monthLabel,
        t.merchant,
        cat ? cat.name : 'Uncategorized',
        t.amount.toFixed(2),
        t.description || ''
      ].map(csvEscape).join(','));
    });

    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'budgy-transactions' + (from || to ? '_' + (from||'start') + '_to_' + (to||'now') : '_all-time') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openExportModal(){
    closeNavMenu();
    var todayStr = fmtDateInput(new Date());
    modal.innerHTML =
      '<h2>Export transactions</h2>'+
      '<div class="field"><label>Quick range</label>'+
        '<div class="export-presets">'+
          '<button type="button" class="export-preset" data-preset="all">All Time</button>'+
          '<button type="button" class="export-preset" data-preset="thisMonth">This Month</button>'+
          '<button type="button" class="export-preset" data-preset="lastMonth">Last Month</button>'+
          '<button type="button" class="export-preset" data-preset="last30">Last 30 Days</button>'+
          '<button type="button" class="export-preset" data-preset="last60">Last 60 Days</button>'+
          '<button type="button" class="export-preset" data-preset="last90">Last 90 Days</button>'+
          '<button type="button" class="export-preset" data-preset="ytd">YTD</button>'+
          '<button type="button" class="export-preset" data-preset="lastYear">Last Year</button>'+
        '</div>'+
      '</div>'+
      '<div class="field"><label for="exportFrom">From</label><input type="date" id="exportFrom"></div>'+
      '<div class="field"><label for="exportTo">To</label><input type="date" id="exportTo"></div>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelExport">Cancel</button>'+
        '<button class="btn-primary" id="confirmExport">Download CSV</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('cancelExport').addEventListener('click', closeModal);

    function setRange(fromStr, toStr){
      document.getElementById('exportFrom').value = fromStr || '';
      document.getElementById('exportTo').value = toStr || '';
    }
    modal.querySelectorAll('.export-preset').forEach(function(btn){
      btn.addEventListener('click', function(){
        modal.querySelectorAll('.export-preset').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var now = new Date();
        var preset = btn.getAttribute('data-preset');
        if (preset==='all'){
          setRange('', '');
        } else if (preset==='thisMonth'){
          setRange(fmtDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), todayStr);
        } else if (preset==='lastMonth'){
          setRange(
            fmtDateInput(new Date(now.getFullYear(), now.getMonth()-1, 1)),
            fmtDateInput(new Date(now.getFullYear(), now.getMonth(), 0))
          );
        } else if (preset==='last30'){
          var d30 = new Date(now); d30.setDate(d30.getDate()-30);
          setRange(fmtDateInput(d30), todayStr);
        } else if (preset==='last60'){
          var d60 = new Date(now); d60.setDate(d60.getDate()-60);
          setRange(fmtDateInput(d60), todayStr);
        } else if (preset==='last90'){
          var d90 = new Date(now); d90.setDate(d90.getDate()-90);
          setRange(fmtDateInput(d90), todayStr);
        } else if (preset==='ytd'){
          setRange(fmtDateInput(new Date(now.getFullYear(), 0, 1)), todayStr);
        } else if (preset==='lastYear'){
          setRange(
            fmtDateInput(new Date(now.getFullYear()-1, 0, 1)),
            fmtDateInput(new Date(now.getFullYear()-1, 11, 31))
          );
        }
      });
    });
    ['exportFrom','exportTo'].forEach(function(id){
      document.getElementById(id).addEventListener('input', function(){
        modal.querySelectorAll('.export-preset').forEach(function(b){ b.classList.remove('active'); });
      });
    });
    document.getElementById('confirmExport').addEventListener('click', function(){
      var from = document.getElementById('exportFrom').value;
      var to = document.getElementById('exportTo').value;
      downloadTransactionsCsv(from, to);
      closeModal();
    });
  }
  document.getElementById('exportBtn').addEventListener('click', openExportModal);

  function openBackfillModal(){
    closeNavMenu();
    renderBackfillModal('single');
  }

  function renderBackfillModal(mode){
    var catOptions = state.categories.map(function(c){
      return '<option value="'+c.id+'">'+escapeHtml(c.name)+(c.archived?' (archived)':'')+'</option>';
    }).join('');

    var tabsHtml =
      '<div class="export-presets" style="margin-bottom:16px;">'+
        '<button type="button" class="export-preset backfill-tab'+(mode==='single'?' active':'')+'" data-mode="single">Single Entry</button>'+
        '<button type="button" class="export-preset backfill-tab'+(mode==='bulk'?' active':'')+'" data-mode="bulk">Bulk Paste</button>'+
      '</div>';

    if (mode === 'single'){
      modal.innerHTML =
        '<h2>Enter past spending</h2>'+
        tabsHtml+
        '<p style="font-size:12px;color:var(--ink-soft);margin:-8px 0 16px;">For months before you started using budgy. Adds one lump-sum transaction for that category/month, and sets its budget if you enter one.</p>'+
        '<div class="field"><label for="backfillCat">Category</label><select id="backfillCat">'+catOptions+'</select></div>'+
        '<div class="field"><label for="backfillMonth">Month</label><input type="month" id="backfillMonth"></div>'+
        '<div class="field"><label for="backfillSpent">Amount spent</label><input type="number" min="0" step="0.01" id="backfillSpent" placeholder="0.00"></div>'+
        '<div class="field"><label for="backfillBudget">Budget for that month (optional)</label><input type="number" min="0" step="0.01" id="backfillBudget" placeholder="0.00"></div>'+
        '<div class="backfill-saved-msg" id="backfillSavedMsg"></div>'+
        '<div class="modal-actions">'+
          '<button class="btn-secondary" id="cancelBackfill">Done</button>'+
          '<button class="btn-primary" id="confirmBackfill">Save</button>'+
        '</div>';
    } else {
      var catNames = state.categories.map(function(c){ return c.name; }).join(', ');
      modal.innerHTML =
        '<h2>Bulk import past spending</h2>'+
        tabsHtml+
        '<p style="font-size:12px;color:var(--ink-soft);margin:-8px 0 12px;">Paste rows as <b>Category, Month, Spent, Budget</b> — one per line, comma-separated. Budget column is optional. Month must be YYYY-MM. Category names must match exactly (case-insensitive).</p>'+
        '<p class="field-hint" style="margin-bottom:10px;">Your categories: '+escapeHtml(catNames)+'</p>'+
        '<textarea id="backfillBulkText" rows="8" placeholder="Groceries, 2026-01, 450.00, 500\nDining Out, 2026-01, 120.00, 150\nGroceries, 2026-02, 410.00, 500" style="width:100%; padding:12px; border:1px solid var(--rule); background:var(--paper-dim); font-family:\'IBM Plex Mono\',monospace; font-size:13px; border-radius:var(--radius); color:var(--ink); resize:vertical;"></textarea>'+
        '<div id="backfillBulkSummary" style="margin-top:10px; font-family:\'IBM Plex Mono\',monospace; font-size:12px; color:var(--ink-soft);"></div>'+
        '<div class="modal-actions">'+
          '<button class="btn-secondary" id="cancelBackfill">Done</button>'+
          '<button class="btn-primary" id="confirmBulkImport" disabled>Import 0 rows</button>'+
        '</div>';
    }

    overlay.classList.add('open');

    modal.querySelectorAll('.backfill-tab').forEach(function(tab){
      tab.addEventListener('click', function(){
        renderBackfillModal(tab.getAttribute('data-mode'));
      });
    });
    document.getElementById('cancelBackfill').addEventListener('click', function(){ closeModal(); render(); });

    if (mode === 'single'){
      document.getElementById('confirmBackfill').addEventListener('click', function(){
        var categoryId = document.getElementById('backfillCat').value;
        var month = document.getElementById('backfillMonth').value;
        var spent = parseFloat(document.getElementById('backfillSpent').value);
        var budgetVal = document.getElementById('backfillBudget').value;

        if (!categoryId || !month) { alert('Pick a category and month.'); return; }
        if (isNaN(spent) || spent < 0) { alert('Enter a valid amount spent.'); return; }

        var confirmBtn = document.getElementById('confirmBackfill');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Saving…';

        var steps = [
          apiFetch(API_BASE + '/transactions', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              merchant: 'Historical total',
              amount: spent,
              date: month + '-01',
              description: 'Backfilled historical total',
              categoryId: categoryId
            })
          })
        ];
        if (budgetVal !== '' && !isNaN(parseFloat(budgetVal))) {
          steps.push(apiFetch(API_BASE + '/budgets', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ categoryId: categoryId, month: month, amount: parseFloat(budgetVal) })
          }));
        }

        Promise.all(steps)
          .then(function(){ return load(); })
          .then(function(){
            render();
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Save';
            var catObj = state.categories.find(function(c){ return c.id===categoryId; });
            var monthLabel = monthNames[parseInt(month.split('-')[1],10)-1] + ' ' + month.split('-')[0];
            document.getElementById('backfillSpent').value = '';
            document.getElementById('backfillBudget').value = '';
            var savedMsg = document.getElementById('backfillSavedMsg');
            savedMsg.textContent = '✓ Saved ' + fmt(spent) + ' to ' + (catObj ? catObj.name : 'category') + ' for ' + monthLabel;
            savedMsg.classList.add('show');
            setTimeout(function(){ savedMsg.classList.remove('show'); }, 3000);
          })
          .catch(function(err){
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Save';
            showApiError(err);
          });
      });
    } else {
      // Bulk paste mode: parse+validate live as the user types, only
      // enabling import once there's at least one valid row.
      var parsedEntries = [];

      function parseBulkText(){
        var text = document.getElementById('backfillBulkText').value;
        var lines = text.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length>0; });
        var results = [];
        var rowErrors = [];
        lines.forEach(function(line, idx){
          var lower = line.toLowerCase().replace(/\s/g,'');
          if (idx===0 && lower.indexOf('category')===0 && lower.indexOf('month')>-1) return; // skip header row
          var parts = line.split(',').map(function(p){ return p.trim(); });
          if (parts.length < 3) { rowErrors.push('Line '+(idx+1)+': need at least Category, Month, Spent'); return; }
          var catName = parts[0], month = parts[1], spentStr = parts[2], budgetStr = parts[3];
          var cat = state.categories.find(function(c){ return c.name.toLowerCase()===catName.toLowerCase(); });
          if (!cat) { rowErrors.push('Line '+(idx+1)+': category "'+catName+'" not found'); return; }
          if (!/^\d{4}-\d{2}$/.test(month)) { rowErrors.push('Line '+(idx+1)+': month "'+month+'" must be YYYY-MM'); return; }
          var spent = parseFloat(spentStr);
          if (isNaN(spent) || spent < 0) { rowErrors.push('Line '+(idx+1)+': invalid amount "'+spentStr+'"'); return; }
          var entry = { categoryId: cat.id, month: month, spent: spent };
          if (budgetStr !== undefined && budgetStr !== ''){
            var budget = parseFloat(budgetStr);
            if (!isNaN(budget) && budget >= 0) entry.budget = budget;
          }
          results.push(entry);
        });
        return { results: results, errors: rowErrors };
      }

      function refreshBulkPreview(){
        var parsed = parseBulkText();
        parsedEntries = parsed.results;
        var summary = document.getElementById('backfillBulkSummary');
        var lines = [];
        if (parsedEntries.length) lines.push('<span style="color:var(--green);">'+parsedEntries.length+' valid row'+(parsedEntries.length===1?'':'s')+' ready to import</span>');
        if (parsed.errors.length) lines.push('<span style="color:var(--red);">'+parsed.errors.join('<br>')+'</span>');
        summary.innerHTML = lines.join('<br>');
        var importBtn = document.getElementById('confirmBulkImport');
        importBtn.disabled = parsedEntries.length === 0;
        importBtn.textContent = 'Import ' + parsedEntries.length + ' row' + (parsedEntries.length===1?'':'s');
      }

      document.getElementById('backfillBulkText').addEventListener('input', refreshBulkPreview);

      document.getElementById('confirmBulkImport').addEventListener('click', function(){
        if (!parsedEntries.length) return;
        var importBtn = document.getElementById('confirmBulkImport');
        importBtn.disabled = true;
        importBtn.textContent = 'Importing…';
        var importedCount = parsedEntries.length;
        apiFetch(API_BASE + '/transactions/bulk-backfill', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ entries: parsedEntries })
        })
          .then(function(result){
            return load().then(function(){ return result; });
          })
          .then(function(result){
            render();
            document.getElementById('backfillBulkText').value = '';
            parsedEntries = [];
            refreshBulkPreview();
            var summary = document.getElementById('backfillBulkSummary');
            var msg = '<span class="backfill-saved-msg show">✓ Imported '+result.inserted+' row'+(result.inserted===1?'':'s')+'</span>';
            if (result.errors && result.errors.length){
              msg += '<br><span style="color:var(--red);">'+result.errors.length+' row'+(result.errors.length===1?'':'s')+' failed — '+
                result.errors.map(function(e){ return 'Line '+e.row+': '+escapeHtml(e.error); }).join(', ')+
              '</span>';
            }
            summary.innerHTML = msg;
          })
          .catch(function(err){
            importBtn.disabled = false;
            importBtn.textContent = 'Import ' + importedCount + ' rows';
            showApiError(err);
          });
      });
    }
  }
  document.getElementById('backfillBtn').addEventListener('click', openBackfillModal);

  document.getElementById('signOutBtn').addEventListener('click', function(){
    var logoutUrl = isGuest ? '/api/guest-logout' : '/api/logout';
    var redirectUrl = isGuest ? '/guest-login' : '/login';
    fetch(logoutUrl, { method: 'POST' }).catch(function(){}).then(function(){
      window.location.href = redirectUrl;
    });
  });

  // connect a real bank account via Plaid Link
  // Update-mode Link: fixes a connection Plaid flagged as ITEM_LOGIN_REQUIRED
  // (changed password, MFA reset, etc.) without deleting and relinking it —
  // the existing access_token, cursor, and transaction history all stay
  // intact. No exchange step needed after onSuccess; a normal sync confirms
  // the item is healthy again and clears the "needs attention" banner.
  function reconnectItem(itemLocalId){
    apiFetch('/api/plaid/create-update-link-token', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: itemLocalId })
    })
      .then(function(data){
        if (!data.link_token) throw new Error('No link_token returned');
        if (!window.Plaid) throw new Error('Plaid Link script not loaded yet — try again in a moment');
        var handler = window.Plaid.create({
          token: data.link_token,
          onSuccess: function(){
            apiFetch('/api/plaid/sync-all', { method:'POST' })
              .then(function(){ return load(); })
              .then(function(){ render(); })
              .catch(showApiError);
          },
          onExit: function(err, metadata){
            if (err) {
              console.error('[Plaid Link (update mode) exited with error]', {
                error_code: err.error_code,
                error_message: err.error_message,
                error_type: err.error_type,
                link_session_id: metadata && metadata.link_session_id,
                request_id: err.request_id || (metadata && metadata.request_id),
              });
            }
          }
        });
        handler.open();
      })
      .catch(function(err){
        console.error(err);
        alert('Could not start reconnect: ' + err.message);
      });
  }
  document.getElementById('reauthBanner').addEventListener('click', function(){
    var flagged = (state.plaidItems || []).find(function(i){ return i.needsReauth; });
    if (flagged) reconnectItem(flagged.id);
  });

  // Push notifications — registers the service worker, asks for
  // permission, and subscribes this specific browser/device. iOS Safari
  // only supports this if the site has been added to the Home Screen
  // (iOS 16.4+) and is being opened as that installed app — a regular
  // Safari tab can't receive push on iOS, no way around that.
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }
  function refreshNotificationsToggle(){
    var toggle = document.getElementById('notificationsToggleSwitch');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toggle.classList.remove('on');
      return;
    }
    navigator.serviceWorker.getRegistration('/sw.js').then(function(reg){
      if (!reg) { toggle.classList.remove('on'); return; }
      return reg.pushManager.getSubscription();
    }).then(function(sub){
      if (sub) toggle.classList.add('on'); else toggle.classList.remove('on');
    }).catch(function(){ toggle.classList.remove('on'); });
  }

  function enableNotifications(){
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications aren\'t supported in this browser. On iPhone, add this site to your Home Screen first (Share → Add to Home Screen), then try again from the installed app.');
      return;
    }
    Notification.requestPermission().then(function(permission){
      if (permission !== 'granted') {
        alert('Notification permission was not granted.');
        return;
      }
      navigator.serviceWorker.register('/sw.js')
        .then(function(){
          // register() resolves as soon as registration exists, which can
          // be before the worker is actually active — pushManager.subscribe
          // needs an active one. .ready specifically waits for that.
          return navigator.serviceWorker.ready;
        })
        .then(function(registration){
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
          });
        })
        .then(function(subscription){
          return apiFetch('/api/push/subscribe', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(subscription)
          });
        })
        .then(function(){
          refreshNotificationsToggle();
        })
        .catch(function(err){
          console.error(err);
          alert('Could not enable notifications: ' + err.message);
        });
    });
  }

  function disableNotifications(){
    navigator.serviceWorker.getRegistration('/sw.js').then(function(reg){
      if (!reg) return;
      return reg.pushManager.getSubscription().then(function(sub){
        if (!sub) return;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function(){
          return apiFetch('/api/push/unsubscribe', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ endpoint: endpoint })
          });
        });
      });
    }).then(function(){
      refreshNotificationsToggle();
    }).catch(function(err){
      console.error(err);
      alert('Could not disable notifications: ' + err.message);
    });
  }

  if (!isGuest) {
    document.getElementById('notificationsToggleRow').addEventListener('click', function(){
      var toggle = document.getElementById('notificationsToggleSwitch');
      if (toggle.classList.contains('on')) {
        disableNotifications();
      } else {
      enableNotifications();
    }
  });
  }

  function connectBank(){
    apiFetch('/api/plaid/create-link-token', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({})
    })
      .then(function(data){
        if (!data.link_token) throw new Error('No link_token returned');
        if (!window.Plaid) throw new Error('Plaid Link script not loaded yet — try again in a moment');
        var handler = window.Plaid.create({
          token: data.link_token,
          onSuccess: function(public_token, metadata){
            apiFetch('/api/plaid/exchange-public-token', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({
                public_token: public_token,
                institutionName: metadata && metadata.institution ? metadata.institution.name : null
              })
            }).then(function(){ return load(); }).then(function(){ render(); closeNavMenu(); }).catch(showApiError);
          },
          onExit: function(err, metadata){
            // Plaid hands back diagnostic info here even when Link fails
            // before ever reaching onSuccess — a generic "Something went
            // wrong" in the UI still carries a link_session_id (and often
            // a request_id) that Plaid support can look up on their end,
            // even when nothing shows up in your own logs or Dashboard
            // Activity view. Log it so it's not silently lost.
            if (err) {
              console.error('[Plaid Link exited with error]', {
                error_code: err.error_code,
                error_message: err.error_message,
                error_type: err.error_type,
                link_session_id: metadata && metadata.link_session_id,
                request_id: err.request_id || (metadata && metadata.request_id),
                institution: metadata && metadata.institution,
              });
            }
          }
        });
        handler.open();
      })
      .catch(function(err){
        console.error(err);
        alert('Could not start Plaid Link: ' + err.message + '\n\nCheck PLAID_CLIENT_ID / PLAID_SECRET are set correctly and that the server was restarted/redeployed after setting them.');
      });
  }

  // categorize inbox flow
  var czQueue = [];
  var czIndex = 0;
  var czTotal = 0;
  var czLastAction = null;

  function openCategorize(){
    czQueue = getPending();
    if (!czQueue.length) return;
    czIndex = 0;
    czTotal = czQueue.length;
    czLastAction = null;
    document.getElementById('czOverlay').classList.add('open');
    renderCzCard();
  }
  function closeCategorize(){
    document.getElementById('czOverlay').classList.remove('open');
    czLastAction = null;
    render();
  }
  document.getElementById('czClose').addEventListener('click', closeCategorize);

  function renderCzCard(){
    czQueue = getPending();
    var body = document.getElementById('czBody');
    if (czIndex >= czQueue.length){
      closeCategorize();
      return;
    }
    var t = czQueue[czIndex];
    var doneCount = czTotal - czQueue.length;
    var czPct = czTotal ? (doneCount/czTotal*100) : 0;
    var czFillEl = document.getElementById('czProgressBarFill');
    czFillEl.style.width = czPct + '%';
    czFillEl.style.minWidth = doneCount > 0 ? '2px' : '0px';
    document.getElementById('czProgressCount').textContent = (czIndex+1) + ' of ' + czQueue.length;

    var chips = state.categories.filter(function(c){ return !c.archived; }).map(function(c){
      var color = colorFor(c);
      return '<button class="cz-chip" data-cat="'+c.id+'" style="background:'+color.bg+';color:'+color.fg+'">'+escapeHtml(c.name)+'</button>';
    }).join('');

    var undoHtml = czLastAction
      ? '<button class="cz-undo" id="czUndo">↩ Undo — categorized "'+escapeHtml(czLastAction.merchant)+'"</button>'
      : '';

    body.innerHTML =
      '<div class="cz-card">'+
        '<div class="cz-tag">NEW</div><br>'+
        '<div class="cz-amount">'+fmt(t.amount)+'</div>'+
        '<div class="cz-merchant">'+escapeHtml(t.merchant)+'</div>'+
        '<div class="cz-date">'+t.date+'</div>'+
      '</div>'+
      '<div class="cz-label">DESCRIPTION (OPTIONAL)</div>'+
      '<input type="text" id="czDesc" class="cz-desc-input" placeholder="e.g. Team lunch" value="'+escapeHtml(t.description||'')+'">'+
      '<div class="cz-label">CATEGORIZE AS</div>'+
      '<div class="cz-chips">'+chips+'</div>'+
      '<button class="cz-skip" id="czSkip">Skip for now</button>'+
      undoHtml;

    body.querySelectorAll('.cz-chip[data-cat]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var categoryId = btn.getAttribute('data-cat');
        var descEl = document.getElementById('czDesc');
        var description = descEl ? descEl.value.trim() : '';
        fetch(API_BASE + '/transactions/' + t.id, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ categoryId: categoryId, description: description })
        }).then(function(){ return load(); }).then(function(){
          czLastAction = { id: t.id, merchant: t.merchant };
          renderCzCard();
        });
      });
    });
    document.getElementById('czSkip').addEventListener('click', function(){
      czIndex++;
      renderCzCard();
    });
    var undoBtn = document.getElementById('czUndo');
    if (undoBtn){
      undoBtn.addEventListener('click', function(){
        var undoneId = czLastAction.id;
        fetch(API_BASE + '/transactions/' + undoneId, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ categoryId: null })
        }).then(function(){ return load(); }).then(function(){
          czLastAction = null;
          renderCzCard();
        });
      });
    }
  }

  // analytics
  var azFilter = '';
  var azSort = 'date-desc';
  var azLargeMin = '';
  var azLargeCat = 'all';
  var azLargeExpanded = false;
  var azTxnPage = 0;
  var AZ_PAGE_SIZE = 25;
  var azPreset = 'thisMonth';
  var azRange = null; // {from, to, label} — set by computeAzRange()

  function fmtDateInputAz(d){ return d.toISOString().slice(0,10); }

  function computeAzRange(preset, customFrom, customTo){
    var now = new Date();
    var today = fmtDateInputAz(now);
    if (preset==='thisMonth'){
      return { from: fmtDateInputAz(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, label: 'This Month' };
    }
    if (preset==='lastMonth'){
      return {
        from: fmtDateInputAz(new Date(now.getFullYear(), now.getMonth()-1, 1)),
        to: fmtDateInputAz(new Date(now.getFullYear(), now.getMonth(), 0)),
        label: 'Last Month'
      };
    }
    if (preset==='ytd'){
      return { from: now.getFullYear()+'-01-01', to: today, label: 'This Year' };
    }
    if (preset==='lastYear'){
      var ly = now.getFullYear()-1;
      return { from: ly+'-01-01', to: ly+'-12-31', label: 'Last Year' };
    }
    if (preset==='last30'){
      var d30 = new Date(now); d30.setDate(d30.getDate()-30);
      return { from: fmtDateInputAz(d30), to: today, label: 'Last 30 Days' };
    }
    if (preset==='last90'){
      var d90 = new Date(now); d90.setDate(d90.getDate()-90);
      return { from: fmtDateInputAz(d90), to: today, label: 'Last 90 Days' };
    }
    if (preset==='custom'){
      var from = customFrom || today;
      var to = customTo || today;
      return { from: from, to: to, label: from + ' – ' + to };
    }
    return { from: fmtDateInputAz(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, label: 'This Month' };
  }

  function openAnalytics(){
    azPreset = 'thisMonth';
    azRange = computeAzRange('thisMonth');
    azFilter = ''; azSort = 'date-desc'; azLargeMin = ''; azLargeCat = 'all'; azLargeExpanded = false; azTxnPage = 0;
    document.getElementById('azOverlay').classList.add('open');
    document.getElementById('azCustomRange').hidden = true;
    renderAnalytics();
  }
  function closeAnalytics(){ document.getElementById('azOverlay').classList.remove('open'); }

  function hideBarTooltip(){
    var tip = document.getElementById('azBarTooltip');
    if (tip) tip.hidden = true;
  }
  function showBarTooltip(col){
    var tip = document.getElementById('azBarTooltip');
    if (!tip) return;
    var spent = parseFloat(col.getAttribute('data-spent'));
    var budget = parseFloat(col.getAttribute('data-budget'));
    tip.innerHTML =
      '<div class="az-bar-tooltip-month">'+col.getAttribute('data-month')+'</div>'+
      '<div class="az-bar-tooltip-row"><span>Spent</span><span>'+fmt(spent)+'</span></div>'+
      '<div class="az-bar-tooltip-row"><span>Budget</span><span>'+fmt(budget)+'</span></div>';
    // Positioned from the bar's real on-screen location (not a CSS
    // ancestor relationship) — some ancestor in the scroll chain was
    // clipping the old bottom-anchored absolute positioning even though
    // its own computed styles reported normal visibility.
    var rect = col.getBoundingClientRect();
    tip.style.left = (rect.left + rect.width/2) + 'px';
    tip.style.top = (rect.top - 10) + 'px';
    tip.hidden = false;
    tip.dataset.forMonth = col.getAttribute('data-month');
  }

  // Delegated on #azBody (registered once) rather than on each .az-bar-col
  // (which gets re-created on every renderAnalytics() call) — avoids any
  // chance of stale/missing listeners after a re-render. Click-only now
  // (no hover): tap a bar to show its tooltip, it stays open until you
  // tap it again or tap anywhere else to dismiss.
  var azBodyEl = document.getElementById('azBody');
  azBodyEl.addEventListener('click', function(e){
    var col = e.target.closest('.az-bar-col');
    if (!col) return;
    e.stopPropagation();
    var tip = document.getElementById('azBarTooltip');
    if (tip && !tip.hidden && tip.dataset.forMonth === col.getAttribute('data-month')){
      hideBarTooltip();
    } else {
      showBarTooltip(col);
    }
  });
  document.addEventListener('click', function(e){
    if (!e.target.closest('.az-bar-col')) hideBarTooltip();
  });

  function renderAnalytics(){
    document.querySelectorAll('#azPresetTabs .az-tab').forEach(function(tab){
      tab.classList.toggle('active', tab.getAttribute('data-preset')===azPreset);
    });
    document.getElementById('azCustomRange').hidden = azPreset !== 'custom';

    var periodLabel = azRange.label;
    var from = azRange.from, to = azRange.to;

    // Every calendar month touched by [from, to] — spentFor/budgetFor are
    // per-month, so anything spanning multiple months (a year, "last 90
    // days", a custom range) needs to sum across each one it overlaps.
    var monthsInRange = [];
    (function(){
      var start = new Date(from + 'T00:00:00');
      var end = new Date(to + 'T00:00:00');
      var cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      var guard = 0;
      while (cursor <= end && guard < 600){
        monthsInRange.push(cursor.getFullYear() + '-' + String(cursor.getMonth()+1).padStart(2,'0'));
        cursor.setMonth(cursor.getMonth()+1);
        guard++;
      }
    })();
    var isMultiMonth = monthsInRange.length > 1;

    var excludedIds = state.categories.filter(function(c){ return c.excludeFromSpending; }).map(function(c){ return c.id; });

    var txns = state.transactions.filter(function(t){ return t.date >= from && t.date <= to; });
    var totalSpentP = txns
      .filter(function(t){ return excludedIds.indexOf(t.categoryId)===-1; })
      .reduce(function(s,t){ return s+t.amount; }, 0);

    var overspent = [];
    var catSpendBreakdown = [];
    var totalBudgetP = 0, totalCatSpentP = 0;
    state.categories.forEach(function(cat){
      if (cat.excludeFromSpending) return;
      var spent = 0, budget = 0;
      monthsInRange.forEach(function(mk){
        spent += spentFor(cat.id, mk);
        budget += budgetFor(cat.id, mk);
      });
      totalBudgetP += budget;
      totalCatSpentP += spent;
      if (spent>0) catSpendBreakdown.push({cat:cat, total:spent});
      if (budget>0 && spent>budget) overspent.push({cat:cat, spent:spent, budget:budget, over:spent-budget});
    });
    overspent.sort(function(a,b){ return b.over-a.over; });
    catSpendBreakdown.sort(function(a,b){ return b.total-a.total; });
    var totalOverAmt = totalCatSpentP - totalBudgetP;
    var totalOverPct = totalBudgetP > 0 ? Math.round(totalOverAmt / totalBudgetP * 100) : 0;

    var monthlyBars = [];
    if (isMultiMonth){
      var maxMonthlyVal = 0;
      monthsInRange.forEach(function(mk3){
        var isFuture = mk3 > todayMonth;
        var mBudget = 0, mSpent = 0;
        state.categories.forEach(function(cat){
          if (cat.excludeFromSpending) return;
          mBudget += budgetFor(cat.id, mk3);
          mSpent += spentFor(cat.id, mk3);
        });
        if (!isFuture) maxMonthlyVal = Math.max(maxMonthlyVal, mBudget, mSpent);
        var moNum = parseInt(mk3.split('-')[1], 10);
        var yr = mk3.split('-')[0];
        monthlyBars.push({
          abbr: monthNames[moNum-1].slice(0,3) + (monthsInRange.length>12 ? " '" + yr.slice(2) : ''),
          full: monthNames[moNum-1] + ' ' + yr,
          spent: isFuture ? 0 : mSpent,
          budget: isFuture ? 0 : mBudget,
          status: isFuture ? 'none' : statusFor(mSpent, mBudget),
          isCurrent: mk3===todayMonth,
          isFuture: isFuture
        });
      });
      maxMonthlyVal = Math.max(1, maxMonthlyVal);
      monthlyBars.forEach(function(m){
        m.spentH = Math.round(Math.min(1, m.spent/maxMonthlyVal) * 130);
        m.budgetH = Math.round(Math.min(1, m.budget/maxMonthlyVal) * 130);
      });
    }

    var minAmt = parseFloat(azLargeMin) || 0;
    var largePool = txns.slice()
      .filter(function(t){ return t.amount >= minAmt; })
      .filter(function(t){ return azLargeCat==='all' || t.categoryId===azLargeCat; })
      .sort(function(a,b){ return b.amount-a.amount; });
    var showAllLarge = azLargeExpanded || minAmt > 0 || azLargeCat !== 'all';
    var largeDisplay = showAllLarge ? largePool : largePool.slice(0,5);

    var filtered = txns.filter(function(t){
      return !azFilter || t.merchant.toLowerCase().indexOf(azFilter.toLowerCase())>-1;
    });
    filtered.sort(function(a,b){
      switch(azSort){
        case 'date-asc': return a.date.localeCompare(b.date);
        case 'amount-desc': return b.amount-a.amount;
        case 'amount-asc': return a.amount-b.amount;
        case 'merchant-asc': return a.merchant.localeCompare(b.merchant);
        case 'merchant-desc': return b.merchant.localeCompare(a.merchant);
        default: return b.date.localeCompare(a.date);
      }
    });

    var html = '';
    html += '<div class="az-summary">'+
      '<div><span class="az-stat-label">'+periodLabel.toUpperCase()+' TOTAL</span><span class="az-stat-val">'+fmt(totalSpentP)+'</span></div>'+
      '<div><span class="az-stat-label">TRANSACTIONS</span><span class="az-stat-val">'+txns.length+'</span></div>'+
    '</div>';

    if (isMultiMonth){
      html += '<div class="az-section"><div class="az-section-title">By month</div><div class="az-month-table">';
      monthsInRange.forEach(function(mk2){
        var moNum = parseInt(mk2.split('-')[1], 10);
        var mTxns = state.transactions.filter(function(t){ return t.date.indexOf(mk2)===0; });
        var mTotal = mTxns
          .filter(function(t){ return excludedIds.indexOf(t.categoryId)===-1; })
          .reduce(function(s,t){ return s+t.amount; }, 0);
        html += '<div class="az-month-row'+(mk2===currentMonth?' current':'')+'"><span>'+monthNames[moNum-1].slice(0,3)+' '+mk2.split('-')[0]+'</span><span>'+mTxns.length+' txns</span><span>'+fmt(mTotal)+'</span></div>';
      });
      html += '</div></div>';

      html += '<div class="az-section"><div class="az-section-title">Monthly spend vs. budget</div>'+
        '<div class="az-bar-legend"><span><span class="az-bar-swatch spend"></span>Spent</span><span><span class="az-bar-swatch budget"></span>Budget</span></div>'+
        '<div class="az-bar-chart-scroll"><div class="az-bar-chart">'+
        monthlyBars.map(function(m){
          var statusClass = m.status==='over' ? 'over' : (m.status==='warn' ? 'warn' : '');
          return '<div class="az-bar-col'+(m.isCurrent?' current':'')+'" data-spent="'+m.spent+'" data-budget="'+m.budget+'" data-month="'+escapeHtml(m.full)+'">'+
            '<div class="az-bar-group">'+
              '<div class="az-bar-track"><div class="az-bar-fill '+statusClass+'" style="height:'+m.spentH+'px"></div></div>'+
              '<div class="az-bar-track"><div class="az-bar-fill budget-fill" style="height:'+m.budgetH+'px"></div></div>'+
            '</div>'+
            '<div class="az-bar-month">'+m.abbr+'</div>'+
          '</div>';
        }).join('')+
        '<div class="az-bar-tooltip" id="azBarTooltip" hidden></div>'+
        '</div></div>'+
      '</div>';
    }

    var pieGrandTotal = catSpendBreakdown.reduce(function(s,x){ return s+x.total; }, 0);
    var pieGradientParts = [];
    var pieCursorDeg = 0;
    catSpendBreakdown.forEach(function(x){
      var color = colorFor(x.cat);
      var deg = pieGrandTotal>0 ? (x.total/pieGrandTotal*360) : 0;
      pieGradientParts.push(color.bg+' '+pieCursorDeg.toFixed(2)+'deg '+(pieCursorDeg+deg).toFixed(2)+'deg');
      pieCursorDeg += deg;
    });
    var pieGradient = pieGradientParts.length ? 'conic-gradient('+pieGradientParts.join(', ')+')' : 'var(--paper-dim)';

    html += '<div class="az-section"><div class="az-section-title">Spending by category ('+escapeHtml(periodLabel)+')</div>';
    if (catSpendBreakdown.length){
      html += '<div class="az-pie-wrap"><div class="az-pie" style="background:'+pieGradient+'"></div></div>';
      html += '<div class="az-pie-legend">'+catSpendBreakdown.map(function(x){
        var color = colorFor(x.cat);
        var pct = pieGrandTotal>0 ? Math.round(x.total/pieGrandTotal*100) : 0;
        return '<div class="az-pie-legend-row"><span class="cat-dot" style="background:'+color.bg+'"></span><span class="az-pie-legend-name">'+escapeHtml(x.cat.name)+'</span><span class="az-pie-legend-pct">'+pct+'%</span><span class="az-pie-legend-amt">'+fmt(x.total)+'</span></div>';
      }).join('')+'</div>';
    } else {
      html += '<div class="txn-empty">No categorized spending yet in this period.</div>';
    }
    html += '</div>';

    html += '<div class="az-section"><div class="az-section-title">Over budget</div>';
    if (totalBudgetP > 0 && totalOverAmt > 0){
      html += '<div class="az-over-total">OVER BUDGET BY '+fmt(totalOverAmt)+' ('+totalOverPct+'%)</div>';
    }
    html += overspent.length
      ? overspent.map(function(o){
          var color = colorFor(o.cat);
          return '<div class="az-row"><span class="cat-dot" style="background:'+color.bg+'"></span><span class="az-row-name">'+escapeHtml(o.cat.name)+'</span><span class="az-row-amt over">+'+fmt(o.over)+'</span></div>';
        }).join('')
      : '<div class="txn-empty">Nothing over budget.</div>';
    html += '</div>';

    html += '<div class="az-section"><div class="az-section-title">Largest purchases</div>'+
      '<div class="az-controls-row">'+
        '<input type="text" inputmode="decimal" id="azLargeMinInput" class="az-filter" placeholder="Min amount (optional)" value="'+escapeHtml(azLargeMin)+'">'+
        '<select id="azLargeCatSelect" class="az-select">'+
          '<option value="all"'+(azLargeCat==='all'?' selected':'')+'>All categories</option>'+
          state.categories.map(function(c){
            return '<option value="'+c.id+'"'+(azLargeCat===c.id?' selected':'')+'>'+escapeHtml(c.name)+'</option>';
          }).join('')+
        '</select>'+
      '</div>';
    html += largeDisplay.length
      ? largeDisplay.map(function(t,i){
          var descSuffix = t.description ? ' · '+escapeHtml(t.description) : '';
          return '<div class="az-row" data-id="'+t.id+'" style="cursor:pointer;"><span class="az-rank">'+(i+1)+'</span><span class="az-row-name">'+escapeHtml(t.merchant)+'<span class="az-row-sub">'+escapeHtml(catName(t.categoryId))+' · '+t.date.slice(5)+descSuffix+'</span></span><span class="az-row-amt">'+fmt(t.amount)+'</span></div>';
        }).join('')
      : '<div class="txn-empty">No purchases'+(minAmt>0 ? ' over '+fmt(minAmt) : '')+(azLargeCat!=='all' ? ' in '+escapeHtml(catName(azLargeCat)) : '')+'.</div>';
    if (minAmt===0 && azLargeCat==='all' && largePool.length>5){
      html += '<button class="az-toggle-link" id="azLargeToggle">'+(azLargeExpanded ? 'Show top 5' : 'Show all '+largePool.length)+'</button>';
    }
    html += '</div>';

    var azTotalPages = Math.max(1, Math.ceil(filtered.length / AZ_PAGE_SIZE));
    if (azTxnPage >= azTotalPages) azTxnPage = azTotalPages - 1;
    var azPageStart = azTxnPage * AZ_PAGE_SIZE;
    var azPageItems = filtered.slice(azPageStart, azPageStart + AZ_PAGE_SIZE);

    html += '<div class="az-section"><div class="az-section-title">All transactions</div>'+
      '<div class="az-controls-row">'+
        '<input type="text" id="azFilterInput" class="az-filter" placeholder="Filter by merchant or location" value="'+escapeHtml(azFilter)+'">'+
        '<select id="azSortSelect" class="az-select">'+
          '<option value="date-desc"'+(azSort==='date-desc'?' selected':'')+'>Date (newest)</option>'+
          '<option value="date-asc"'+(azSort==='date-asc'?' selected':'')+'>Date (oldest)</option>'+
          '<option value="amount-desc"'+(azSort==='amount-desc'?' selected':'')+'>Amount (high–low)</option>'+
          '<option value="amount-asc"'+(azSort==='amount-asc'?' selected':'')+'>Amount (low–high)</option>'+
          '<option value="merchant-asc"'+(azSort==='merchant-asc'?' selected':'')+'>Merchant (A–Z)</option>'+
          '<option value="merchant-desc"'+(azSort==='merchant-desc'?' selected':'')+'>Merchant (Z–A)</option>'+
        '</select>'+
      '</div>'+
      '<div id="azTxnList">'+
      (azPageItems.length
        ? azPageItems.map(function(t){
            var descPart = t.description ? '<div class="txn-desc">'+escapeHtml(t.description)+'</div>' : '';
            return '<div class="txn-row" data-id="'+t.id+'"><span class="txn-info"><span class="cat-dot" style="background:'+catDotColor(t.categoryId)+'"></span><b>'+escapeHtml(t.merchant)+'</b> · '+escapeHtml(catName(t.categoryId))+' · '+t.date.slice(5)+descPart+'</span><span>'+fmt(t.amount)+'</span></div>';
          }).join('')
        : '<div class="txn-empty">No matching transactions.</div>')+
      '</div>'+
      (filtered.length > AZ_PAGE_SIZE
        ? '<div class="az-pagination">'+
            '<button id="azPrevPage"'+(azTxnPage===0?' disabled':'')+'>‹ Prev</button>'+
            '<span>'+(azPageStart+1)+'–'+Math.min(azPageStart+AZ_PAGE_SIZE, filtered.length)+' of '+filtered.length+'</span>'+
            '<button id="azNextPage"'+(azTxnPage>=azTotalPages-1?' disabled':'')+'>Next ›</button>'+
          '</div>'
        : '')+
      '</div>';

    document.getElementById('azBody').innerHTML = html;

    document.querySelectorAll('#azBody [data-id]').forEach(function(row){
      row.addEventListener('click', function(){
        var tid = row.getAttribute('data-id');
        var t = state.transactions.find(function(x){ return x.id===tid; });
        if (t) openEditTransaction(t);
      });
    });

    var prevPageBtn = document.getElementById('azPrevPage');
    if (prevPageBtn) prevPageBtn.addEventListener('click', function(){
      if (azTxnPage > 0) { azTxnPage--; renderAnalytics(); }
    });
    var nextPageBtn = document.getElementById('azNextPage');
    if (nextPageBtn) nextPageBtn.addEventListener('click', function(){
      if (azTxnPage < azTotalPages-1) { azTxnPage++; renderAnalytics(); }
    });

    var filterInput = document.getElementById('azFilterInput');
    filterInput.addEventListener('input', function(e){
      azFilter = e.target.value;
      azTxnPage = 0;
      var caret = e.target.selectionStart;
      renderAnalytics();
      var newInput = document.getElementById('azFilterInput');
      newInput.focus();
      newInput.setSelectionRange(caret, caret);
    });

    var sortSelect = document.getElementById('azSortSelect');
    sortSelect.addEventListener('change', function(e){
      azSort = e.target.value;
      azTxnPage = 0;
      renderAnalytics();
    });

    var largeMinInput = document.getElementById('azLargeMinInput');
    largeMinInput.addEventListener('input', function(e){
      azLargeMin = e.target.value;
      var caret = e.target.selectionStart;
      renderAnalytics();
      var newInput = document.getElementById('azLargeMinInput');
      newInput.focus();
      newInput.setSelectionRange(caret, caret);
    });

    var largeCatSelect = document.getElementById('azLargeCatSelect');
    largeCatSelect.addEventListener('change', function(e){
      azLargeCat = e.target.value;
      renderAnalytics();
    });

    var largeToggle = document.getElementById('azLargeToggle');
    if (largeToggle){
      largeToggle.addEventListener('click', function(){
        azLargeExpanded = !azLargeExpanded;
        renderAnalytics();
      });
    }
  }

  document.getElementById('addCategoryBtn').addEventListener('click', function(){ openAddCategory(); });
  document.getElementById('simulateBtn').addEventListener('click', openSimulate);
  if (!isGuest) document.getElementById('connectBankBtn').addEventListener('click', connectBank);
  document.getElementById('analyticsBtn').addEventListener('click', openAnalytics);
  document.getElementById('azClose').addEventListener('click', closeAnalytics);
  document.querySelectorAll('#azPresetTabs .az-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      azPreset = tab.getAttribute('data-preset');
      azFilter = ''; azTxnPage = 0;
      if (azPreset === 'custom'){
        // Default the custom pickers to the current range so switching
        // into custom mode starts from somewhere sensible, not blank.
        document.getElementById('azCustomFrom').value = azRange.from;
        document.getElementById('azCustomTo').value = azRange.to;
        azRange = computeAzRange('custom', azRange.from, azRange.to);
      } else {
        azRange = computeAzRange(azPreset);
      }
      renderAnalytics();
    });
  });
  document.getElementById('azCustomApply').addEventListener('click', function(){
    var from = document.getElementById('azCustomFrom').value;
    var to = document.getElementById('azCustomTo').value;
    if (!from || !to) { alert('Pick both a from and to date.'); return; }
    if (from > to) { alert('From date must be before the to date.'); return; }
    azRange = computeAzRange('custom', from, to);
    azFilter = ''; azTxnPage = 0;
    renderAnalytics();
  });
  document.getElementById('pendingBanner').addEventListener('click', openCategorize);

  document.getElementById('prevMonth').addEventListener('click', function(){
    var p = currentMonth.split('-'); var y = Number(p[0]), m = Number(p[1]);
    m -= 1; if (m===0){ m=12; y-=1; }
    currentMonth = y + '-' + String(m).padStart(2,'0');
    render();
  });
  document.getElementById('nextMonth').addEventListener('click', function(){
    var p = currentMonth.split('-'); var y = Number(p[0]), m = Number(p[1]);
    m += 1; if (m===13){ m=1; y+=1; }
    currentMonth = y + '-' + String(m).padStart(2,'0');
    render();
  });

  // Render immediately using the data already fetched server-side (see
  // getServerSideProps above) — no client-side round-trip needed before
  // the first real paint, which is what caused the reload flash this was
  // built to fix. Then catch up in the background on anything that's
  // changed since that server-side fetch (new Plaid data, a missed
  // webhook, etc.) via a sync-all + fresh load + re-render. Guest mode
  // has no Plaid connection at all, so this step is skipped entirely.
  render();

  if (!isGuest) {
    fetch('/api/plaid/sync-all', { method:'POST' })
      .catch(function(){ /* fine if nothing's linked yet, or Plaid keys aren't set up */ })
      .then(function(){ return load(); })
      .then(function(){ render(); })
      .catch(function(err){ console.error('[startup] background refresh failed:', err); });
  }
}