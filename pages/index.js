import { useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__ledgerInitialized) return; // guard against React 18 dev double-invoke
    window.__ledgerInitialized = true;
    initLedgerApp();
  }, []);

  return (
    <>
      <Head>
        <title>Budgy — Spending Tracker</title>
      </Head>

      <div className="sheet">
        <header>
          <div className="sticky-header">
            <div className="brand-row">
              <div className="brand">budgy</div>
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
          <button className="pending-banner" id="pendingBanner">
            <span id="pendingText"></span><span className="arrow">→</span>
          </button>
        </header>

        <div className="perf"></div>

        <main id="categoryList"></main>

        <button className="add-cat-btn" id="addCategoryBtn">+ ADD CATEGORY</button>
        <div className="fab-wrap">
          <button className="fab-secondary connect" id="connectBankBtn">+ CONNECT BANK ACCOUNT</button>
          <button className="fab-secondary" id="syncNowBtn">↻ SYNC NOW</button>
          <button className="fab" id="simulateBtn">+ SIMULATE TRANSACTION</button>
          <div className="hint">Manual entry — for cash, or anything Plaid hasn&apos;t synced yet</div>
        </div>
      </div>

      <div className="modal-overlay" id="modalOverlay">
        <div className="modal" id="modalContent" role="dialog" aria-modal="true"></div>
      </div>

      <div className="cz-overlay" id="czOverlay" role="dialog" aria-modal="true" aria-label="Categorize transactions">
        <div className="cz-progressbar"><div className="cz-progressbar-fill" id="czProgressBarFill"></div></div>
        <div className="cz-body" id="czBody"></div>
      </div>

      <div className="az-overlay" id="azOverlay" role="dialog" aria-modal="true" aria-label="Analytics">
        <div className="az-top">
          <div className="az-title">Analytics</div>
          <button className="az-close" id="azClose" aria-label="Close">✕</button>
        </div>
        <div className="az-tabs">
          <button className="az-tab active" id="azTabMonth">This Month</button>
          <button className="az-tab" id="azTabYear">This Year</button>
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
function initLedgerApp() {
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

  var state = { categories: [], budgets: {}, transactions: [] };

  function load(){
    return fetch('/api/state').then(function(r){ return r.json(); }).then(function(data){ state = data; });
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

    state.categories.forEach(function(cat, idx){
      var spent = spentFor(cat.id, currentMonth);
      var budget = budgetFor(cat.id, currentMonth);
      if (!cat.excludeFromSpending){
        totalSpent += spent; totalBudget += budget;
      }
      var status = statusFor(spent, budget);
      var pct = budget ? Math.min(100, spent/budget*100) : 0;
      var color = colorFor(cat);

      var card = document.createElement('div');
      card.className = 'cat-card';
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
      var isFirst = idx===0;
      var isLast = idx===state.categories.length-1;

      card.innerHTML =
        '<div class="stamp '+stampClass+'">'+stampText+'</div>'+
        '<div class="cat-top">'+
          '<div class="cat-name">'+
            '<span class="cat-reorder">'+
              '<button class="reorder-btn" data-cat="'+cat.id+'" data-dir="up" aria-label="Move '+escapeHtml(cat.name)+' up"'+(isFirst?' disabled':'')+'>▲</button>'+
              '<button class="reorder-btn" data-cat="'+cat.id+'" data-dir="down" aria-label="Move '+escapeHtml(cat.name)+' down"'+(isLast?' disabled':'')+'>▼</button>'+
            '</span>'+
            '<span class="cat-dot" style="background:'+color.bg+'"></span>'+escapeHtml(cat.name)+exclTag+
          '</div>'+
          '<div class="cat-amts"><span class="spent">'+fmt(spent)+'</span><span class="slash"> / </span><span class="budget" data-cat="'+cat.id+'" tabindex="0" role="button" aria-label="Edit budget for '+escapeHtml(cat.name)+'">'+fmt(budget)+'</span></div>'+
        '</div>'+
        '<div class="bar"><div class="bar-fill '+(status==='over'?'over':status==='warn'?'warn':'')+'" style="width:'+pct+'%"></div></div>'+
        '<div class="cat-meta">'+
          '<span class="txn-count">'+txns.length+' transaction'+(txns.length===1?'':'s')+'</span>'+
          '<button class="expand-btn" aria-expanded="false">▾</button>'+
        '</div>'+
        '<div class="txn-list" hidden>'+txnHtml+'<button class="del-cat" data-cat="'+cat.id+'">Remove category</button></div>';

      listEl.appendChild(card);
    });

    document.getElementById('totalSpent').textContent = fmt(totalSpent);
    document.getElementById('totalBudget').textContent = fmt(totalBudget);

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
    document.querySelectorAll('.reorder-btn').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        if (btn.disabled) return;
        var catId = btn.getAttribute('data-cat');
        var dir = btn.getAttribute('data-dir');
        var ids = state.categories.map(function(c){ return c.id; });
        var idx = ids.indexOf(catId);
        var swapIdx = dir==='up' ? idx-1 : idx+1;
        if (swapIdx<0 || swapIdx>=ids.length) return;
        var tmp = ids[idx]; ids[idx] = ids[swapIdx]; ids[swapIdx] = tmp;
        fetch('/api/categories/reorder', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ order: ids })
        }).then(function(){ return load(); }).then(render);
      });
    });
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
            fetch('/api/budgets', {
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
      fetch('/api/categories', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: name, budget: budget, month: currentMonth, excludeFromSpending: excludeFromSpending })
      }).then(function(){ return load(); }).then(function(){ closeModal(); render(); });
    });
  }

  function openConfirmDelete(cat){
    modal.innerHTML =
      '<h2>Remove "'+escapeHtml(cat.name)+'"?</h2>'+
      '<p style="font-size:13px;color:var(--ink-soft);margin:0 0 4px;">Its past transactions stay in your history but won\'t be shown under this category anymore.</p>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelDel">Cancel</button>'+
        '<button class="btn-primary" id="confirmDel" style="background:var(--red);">Remove</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('cancelDel').addEventListener('click', closeModal);
    document.getElementById('confirmDel').addEventListener('click', function(){
      fetch('/api/categories/' + cat.id, { method:'DELETE' })
        .then(function(){ return load(); })
        .then(function(){ closeModal(); render(); });
    });
  }

  function openEditTransaction(t){
    var options = state.categories.map(function(c){
      return '<option value="'+c.id+'"'+(c.id===t.categoryId?' selected':'')+'>'+escapeHtml(c.name)+'</option>';
    }).join('');
    modal.innerHTML =
      '<h2>Edit transaction</h2>'+
      '<div class="field"><label>Details</label><div style="font-family:\'IBM Plex Mono\',monospace;font-size:13px;color:var(--ink-soft);padding:2px 0 4px;">'+escapeHtml(t.merchant)+' · '+fmt(t.amount)+' · '+t.date+'</div></div>'+
      '<div class="field"><label for="editCat">Category</label><select id="editCat">'+options+'</select></div>'+
      '<div class="field"><label for="editDesc">Description (optional)</label><input id="editDesc" type="text" placeholder="e.g. Split with roommate" value="'+escapeHtml(t.description||'')+'"></div>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelEdit">Cancel</button>'+
        '<button class="btn-primary" id="confirmEdit">Save</button>'+
      '</div>';
    overlay.classList.add('open');
    document.getElementById('cancelEdit').addEventListener('click', closeModal);
    document.getElementById('confirmEdit').addEventListener('click', function(){
      var categoryId = document.getElementById('editCat').value;
      var description = document.getElementById('editDesc').value.trim();
      fetch('/api/transactions/' + t.id, {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ categoryId: categoryId, description: description })
      }).then(function(){ return load(); }).then(function(){
        closeModal();
        render();
        if (document.getElementById('azOverlay').classList.contains('open')) renderAnalytics();
      });
    });
  }

  function openSimulate(){
    var today = new Date().toISOString().slice(0,10);
    modal.innerHTML =
      '<h2>Simulate transaction</h2>'+
      '<p style="font-size:12px;color:var(--ink-soft);margin:-8px 0 16px;">Like a real bank alert, it arrives uncategorized — you\'ll file it next.</p>'+
      '<div class="field"><label for="txnMerchant">Merchant / location</label><input id="txnMerchant" type="text" placeholder="e.g. Amazon"></div>'+
      '<div class="field"><label for="txnAmount">Amount</label><input id="txnAmount" type="number" min="0" step="0.01" placeholder="0.00"></div>'+
      '<div class="field"><label for="txnDate">Date</label><input id="txnDate" type="date" value="'+today+'"></div>'+
      '<div class="field"><label for="txnDesc">Description (optional)</label><input id="txnDesc" type="text" placeholder="e.g. Split with roommate"></div>'+
      '<div class="modal-actions">'+
        '<button class="btn-secondary" id="cancelTxn">Cancel</button>'+
        '<button class="btn-primary" id="confirmTxn">Send alert</button>'+
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
      fetch('/api/transactions', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ merchant: merchant, amount: amount, date: date, description: description })
      }).then(function(){ return load(); }).then(function(){
        closeModal();
        openCategorize();
      });
    });
  }

  // connect a real bank account via Plaid Link
  function connectBank(){
    fetch('/api/plaid/create-link-token', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({})
    })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data.link_token) throw new Error('No link_token returned');
        if (!window.Plaid) throw new Error('Plaid Link script not loaded yet — try again in a moment');
        var handler = window.Plaid.create({
          token: data.link_token,
          onSuccess: function(public_token, metadata){
            fetch('/api/plaid/exchange-public-token', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body: JSON.stringify({
                public_token: public_token,
                institutionName: metadata && metadata.institution ? metadata.institution.name : null
              })
            }).then(function(){ return load(); }).then(render);
          }
        });
        handler.open();
      })
      .catch(function(err){
        console.error(err);
        alert('Could not start Plaid Link — check PLAID_CLIENT_ID / PLAID_SECRET in .env.local and that the dev server was restarted after setting them.');
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

  function renderCzCard(){
    czQueue = getPending();
    var body = document.getElementById('czBody');
    if (czIndex >= czQueue.length){
      closeCategorize();
      return;
    }
    var t = czQueue[czIndex];
    var doneCount = czTotal - czQueue.length;
    document.getElementById('czProgressBarFill').style.width = (czTotal ? (doneCount/czTotal*100) : 0) + '%';

    var chips = state.categories.map(function(c){
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
        fetch('/api/transactions/' + t.id, {
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
      closeCategorize();
    });
    var undoBtn = document.getElementById('czUndo');
    if (undoBtn){
      undoBtn.addEventListener('click', function(){
        var undoneId = czLastAction.id;
        fetch('/api/transactions/' + undoneId, {
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
  var azPeriod = 'month';
  var azFilter = '';
  var azSort = 'date-desc';
  var azLargeMin = '';
  var azLargeCat = 'all';
  var azLargeExpanded = false;

  function openAnalytics(){
    azPeriod = 'month'; azFilter = ''; azSort = 'date-desc'; azLargeMin = ''; azLargeCat = 'all'; azLargeExpanded = false;
    document.getElementById('azOverlay').classList.add('open');
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
    tip.style.left = (col.offsetLeft + col.offsetWidth/2) + 'px';
    tip.hidden = false;
    tip.dataset.forMonth = col.getAttribute('data-month');
  }

  // Delegated on #azBody (registered once) rather than on each .az-bar-col
  // (which gets re-created on every renderAnalytics() call) — avoids any
  // chance of stale/missing listeners after a re-render.
  var azBodyEl = document.getElementById('azBody');
  azBodyEl.addEventListener('mouseover', function(e){
    var col = e.target.closest('.az-bar-col');
    if (col) showBarTooltip(col);
  });
  azBodyEl.addEventListener('mouseout', function(e){
    var col = e.target.closest('.az-bar-col');
    if (col) hideBarTooltip();
  });
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
    document.getElementById('azTabMonth').classList.toggle('active', azPeriod==='month');
    document.getElementById('azTabYear').classList.toggle('active', azPeriod==='year');

    var year = currentMonth.split('-')[0];
    var periodLabel = azPeriod==='month'
      ? (monthNames[parseInt(currentMonth.split('-')[1],10)-1] + ' ' + year)
      : year;

    var excludedIds = state.categories.filter(function(c){ return c.excludeFromSpending; }).map(function(c){ return c.id; });

    var txns = state.transactions.filter(function(t){
      return azPeriod==='month' ? t.date.indexOf(currentMonth)===0 : t.date.indexOf(year)===0;
    });
    var totalSpentP = txns
      .filter(function(t){ return excludedIds.indexOf(t.categoryId)===-1; })
      .reduce(function(s,t){ return s+t.amount; }, 0);

    var overspent = [];
    var catSpendBreakdown = [];
    var totalBudgetP = 0, totalCatSpentP = 0;
    state.categories.forEach(function(cat){
      if (cat.excludeFromSpending) return;
      var spent, budget;
      if (azPeriod==='month'){
        spent = spentFor(cat.id, currentMonth);
        budget = budgetFor(cat.id, currentMonth);
      } else {
        spent = 0; budget = 0;
        for (var mo=1; mo<=12; mo++){
          var mk = year + '-' + String(mo).padStart(2,'0');
          spent += spentFor(cat.id, mk);
          budget += budgetFor(cat.id, mk);
        }
      }
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
    if (azPeriod==='year'){
      for (var mo3=1; mo3<=12; mo3++){
        var mk3 = year + '-' + String(mo3).padStart(2,'0');
        var isFuture = mk3 > todayMonth;
        var mBudget = 0, mSpent = 0;
        state.categories.forEach(function(cat){
          if (cat.excludeFromSpending) return;
          mBudget += budgetFor(cat.id, mk3);
          mSpent += spentFor(cat.id, mk3);
        });
        monthlyBars.push({
          abbr: monthNames[mo3-1].slice(0,3),
          full: monthNames[mo3-1],
          spent: mSpent,
          budget: mBudget,
          variance: (isFuture || mBudget<=0) ? null : (mSpent===0 ? 0 : ((mBudget-mSpent)/mBudget*100)),
          isCurrent: mk3===todayMonth
        });
      }
      var maxAbsVariance = Math.max(1, Math.max.apply(null, monthlyBars
        .filter(function(m){ return m.variance!==null; })
        .map(function(m){ return Math.abs(m.variance); })
        .concat([0])));
      monthlyBars.forEach(function(m){
        if (m.variance===null){ m.upPx = 0; m.downPx = 0; return; }
        m.upPx = m.variance>0 ? Math.round(Math.min(1, m.variance/maxAbsVariance)*70) : 0;
        m.downPx = m.variance<0 ? Math.round(Math.min(1, Math.abs(m.variance)/maxAbsVariance)*70) : 0;
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

    if (azPeriod==='year'){
      html += '<div class="az-section"><div class="az-section-title">By month</div><div class="az-month-table">';
      for (var mo2=1; mo2<=12; mo2++){
        var mk2 = year + '-' + String(mo2).padStart(2,'0');
        var mTxns = state.transactions.filter(function(t){ return t.date.indexOf(mk2)===0; });
        var mTotal = mTxns
          .filter(function(t){ return excludedIds.indexOf(t.categoryId)===-1; })
          .reduce(function(s,t){ return s+t.amount; }, 0);
        html += '<div class="az-month-row'+(mk2===currentMonth?' current':'')+'"><span>'+monthNames[mo2-1].slice(0,3)+'</span><span>'+mTxns.length+' txns</span><span>'+fmt(mTotal)+'</span></div>';
      }
      html += '</div></div>';

      html += '<div class="az-section"><div class="az-section-title">Monthly spend vs. budget</div>'+
        '<div class="az-bar-legend"><span><span class="az-bar-swatch spend"></span>Under budget</span><span><span class="az-bar-swatch over"></span>Over budget</span></div>'+
        '<div class="az-bar-chart-scroll"><div class="az-bar-chart">'+
        monthlyBars.map(function(m){
          var upLabel = m.variance!==null && m.variance>0
            ? '<span class="az-diverge-label good">+'+Math.round(m.variance)+'%</span><div class="az-diverge-bar good" style="height:'+m.upPx+'px"></div>'
            : '';
          var downLabel = m.variance!==null && m.variance<0
            ? '<div class="az-diverge-bar over" style="height:'+m.downPx+'px"></div><span class="az-diverge-label over">'+Math.round(m.variance)+'%</span>'
            : '';
          return '<div class="az-bar-col'+(m.isCurrent?' current':'')+'" data-spent="'+m.spent+'" data-budget="'+m.budget+'" data-month="'+escapeHtml(m.full)+'">'+
            '<div class="az-diverge-bars">'+
              '<div class="az-diverge-baseline"></div>'+
              '<div class="az-diverge-upper">'+upLabel+'</div>'+
              '<div class="az-diverge-lower">'+downLabel+'</div>'+
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

    html += '<div class="az-section"><div class="az-section-title">Spending by category'+(azPeriod==='year'?' (YTD)':'')+'</div>';
    if (catSpendBreakdown.length){
      html += '<div class="az-pie-wrap"><div class="az-pie" style="background:'+pieGradient+'"></div></div>';
      html += '<div class="az-pie-legend">'+catSpendBreakdown.map(function(x){
        var color = colorFor(x.cat);
        var pct = pieGrandTotal>0 ? Math.round(x.total/pieGrandTotal*100) : 0;
        return '<div class="az-pie-legend-row"><span class="cat-dot" style="background:'+color.bg+'"></span><span class="az-pie-legend-name">'+escapeHtml(x.cat.name)+'</span><span class="az-pie-legend-pct">'+pct+'%</span><span class="az-pie-legend-amt">'+fmt(x.total)+'</span></div>';
      }).join('')+'</div>';
    } else {
      html += '<div class="txn-empty">No categorized spending yet '+(azPeriod==='year'?'this year':'this month')+'.</div>';
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
      (filtered.length
        ? filtered.map(function(t){
            var descPart = t.description ? '<div class="txn-desc">'+escapeHtml(t.description)+'</div>' : '';
            return '<div class="txn-row" data-id="'+t.id+'"><span class="txn-info"><span class="cat-dot" style="background:'+catDotColor(t.categoryId)+'"></span><b>'+escapeHtml(t.merchant)+'</b> · '+escapeHtml(catName(t.categoryId))+' · '+t.date.slice(5)+descPart+'</span><span>'+fmt(t.amount)+'</span></div>';
          }).join('')
        : '<div class="txn-empty">No matching transactions.</div>')+
      '</div></div>';

    document.getElementById('azBody').innerHTML = html;

    document.querySelectorAll('#azBody [data-id]').forEach(function(row){
      row.addEventListener('click', function(){
        var tid = row.getAttribute('data-id');
        var t = state.transactions.find(function(x){ return x.id===tid; });
        if (t) openEditTransaction(t);
      });
    });

    var filterInput = document.getElementById('azFilterInput');
    filterInput.addEventListener('input', function(e){
      azFilter = e.target.value;
      var caret = e.target.selectionStart;
      renderAnalytics();
      var newInput = document.getElementById('azFilterInput');
      newInput.focus();
      newInput.setSelectionRange(caret, caret);
    });

    var sortSelect = document.getElementById('azSortSelect');
    sortSelect.addEventListener('change', function(e){
      azSort = e.target.value;
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
  document.getElementById('connectBankBtn').addEventListener('click', connectBank);
  document.getElementById('syncNowBtn').addEventListener('click', function(){
    var btn = document.getElementById('syncNowBtn');
    var originalText = btn.textContent;
    btn.textContent = 'SYNCING…';
    btn.disabled = true;
    fetch('/api/plaid/sync-all', { method:'POST' })
      .then(function(r){ return r.json(); })
      .then(function(data){
        return load().then(function(){
          render();
          btn.textContent = originalText;
          btn.disabled = false;
          if (getPending().length) openCategorize();
        });
      })
      .catch(function(err){
        console.error(err);
        btn.textContent = originalText;
        btn.disabled = false;
        alert('Sync failed — check that a bank account is connected and your Plaid keys are set.');
      });
  });
  document.getElementById('analyticsBtn').addEventListener('click', openAnalytics);
  document.getElementById('azClose').addEventListener('click', closeAnalytics);
  document.getElementById('azTabMonth').addEventListener('click', function(){ azPeriod='month'; azFilter=''; renderAnalytics(); });
  document.getElementById('azTabYear').addEventListener('click', function(){ azPeriod='year'; azFilter=''; renderAnalytics(); });
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

  // Render immediately from whatever's already in the database — don't
  // make the first paint wait on a round trip to Plaid. Then catch up on
  // anything missed (a failed webhook delivery) quietly in the background.
  load().then(function(){
    render();
    if (getPending().length) openCategorize();

    fetch('/api/plaid/sync-all', { method:'POST' })
      .catch(function(){ /* fine if nothing's linked yet, or Plaid keys aren't set up */ })
      .then(function(){ return load(); })
      .then(function(){
        render();
        var czAlreadyOpen = document.getElementById('czOverlay').classList.contains('open');
        if (getPending().length && !czAlreadyOpen) openCategorize();
      });
  });
}